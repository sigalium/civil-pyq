import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const ALLOWED_PREFIXES = ['pdfs/', 'Contributor/']
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function extractRepoPath(url) {
  if (typeof url !== 'string' || !url) return null
  const match = url.match(/\/gh\/[^/]+\/[^@]+@[^/]+\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

function isAllowedPath(path) {
  if (typeof path !== 'string' || !path || path.includes('..') || path.startsWith('/')) {
    return false
  }
  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/')
}

async function deleteFromGithub(repoPath, commitMessage, ghConfig) {
  if (!isAllowedPath(repoPath)) {
    return { ok: false, error: `Path not allowed: ${repoPath}` }
  }
  const apiUrl = `https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${encodePath(repoPath)}`
  const ghHeaders = {
    Authorization: `Bearer ${ghConfig.token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'civil-pyq-purge-expired',
  }

  const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(ghConfig.branch)}`, { headers: ghHeaders })
  if (existing.status === 404) {
    return { ok: true, note: 'Already gone from GitHub.' }
  }
  if (existing.status !== 200) {
    const errData = await existing.json().catch(() => ({}))
    return { ok: false, error: `GitHub lookup failed: ${errData.message || existing.status}` }
  }
  const existingData = await existing.json()

  const deleteResponse = await fetch(apiUrl, {
    method: 'DELETE',
    headers: ghHeaders,
    body: JSON.stringify({
      message: commitMessage,
      sha: existingData.sha,
      branch: ghConfig.branch,
    }),
  })

  if (!deleteResponse.ok) {
    const errData = await deleteResponse.json().catch(() => ({}))
    return { ok: false, error: `GitHub delete failed: ${errData.message || deleteResponse.status}` }
  }

  fetch(`https://purge.jsdelivr.net/gh/${ghConfig.owner}/${ghConfig.repo}@${ghConfig.branch}/${encodePath(repoPath)}`, {
    signal: AbortSignal.timeout(4000),
  }).catch(() => {})

  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const providedSecret = req.headers.get('x-cron-secret') || ''
  const expectedSecret = Deno.env.get('CRON_SECRET') || ''
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'Not authorized.' }, 401)
  }

  const owner = Deno.env.get('GITHUB_OWNER')
  const repo = Deno.env.get('GITHUB_REPO')
  const branch = Deno.env.get('GITHUB_BRANCH') || 'main'
  const token = Deno.env.get('GITHUB_TOKEN')
  if (!owner || !repo || !token) {
    return json({ error: 'GitHub is not configured on the server.' }, 500)
  }
  const ghConfig = { owner, repo, branch, token }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const cutoffIso = new Date(Date.now() - RETENTION_MS).toISOString()
  const summary = {
    resourcesDeleted: 0,
    subjectsDeleted: 0,
    contributorsDeleted: 0,
    replacedFilesDeleted: 0,
    githubDeleteErrors: [],
  }

  const { data: expiredResources } = await supabase
    .from('resources')
    .select('id, name, path')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoffIso)

  for (const row of expiredResources || []) {
    const repoPath = extractRepoPath(row.path)
    if (repoPath) {
      const result = await deleteFromGithub(repoPath, `Purge expired trash: ${row.name}`, ghConfig)
      if (!result.ok) summary.githubDeleteErrors.push({ resource: row.name, error: result.error })
    }
    const { error } = await supabase.from('resources').delete().eq('id', row.id)
    if (!error) summary.resourcesDeleted += 1
  }

  const { data: expiredReplaced } = await supabase
    .from('replaced_files')
    .select('id, resource_name, github_path')
    .lt('deleted_at', cutoffIso)

  for (const row of expiredReplaced || []) {
    const result = await deleteFromGithub(row.github_path, `Purge replaced file: ${row.resource_name}`, ghConfig)
    if (!result.ok) summary.githubDeleteErrors.push({ resource: row.resource_name, error: result.error })
    const { error } = await supabase.from('replaced_files').delete().eq('id', row.id)
    if (!error) summary.replacedFilesDeleted += 1
  }

  const { count: subjectsDeleted } = await supabase
    .from('subjects')
    .delete({ count: 'exact' })
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoffIso)
  summary.subjectsDeleted = subjectsDeleted || 0

  const { count: contributorsDeleted } = await supabase
    .from('contributors')
    .delete({ count: 'exact' })
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoffIso)
  summary.contributorsDeleted = contributorsDeleted || 0

  return json({ ok: true, cutoff: cutoffIso, summary })
})
