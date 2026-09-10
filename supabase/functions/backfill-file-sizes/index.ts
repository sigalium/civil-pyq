import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONCURRENCY = 10

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function repoPathFromUrl(url, owner, repo, branch) {
  const prefix = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/`
  if (!url || !url.startsWith(prefix)) return null
  return url.slice(prefix.length)
}

async function fetchSize(owner, repo, branch, path, githubToken) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`
  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'civil-pyq-dashboard',
    },
  })
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    return { size: null, error: `${res.status} ${bodyText}`.slice(0, 200) }
  }
  const data = await res.json()
  return { size: typeof data.size === 'number' ? data.size : null, error: null }
}

async function runBatch(items, worker, concurrency) {
  const results = []
  let index = 0
  async function next() {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await worker(items[current])
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next))
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return json({ error: 'Missing authorization token.' }, 401)

    const authClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'))
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData?.user?.email) return json({ error: 'Not authenticated.' }, 401)

    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

    const { data: admin } = await supabase
      .from('admins')
      .select('role')
      .eq('email', userData.user.email)
      .maybeSingle()

    if (!admin || admin.role !== 'owner') {
      return json({ error: 'Only the owner can run this.' }, 403)
    }

    const owner = Deno.env.get('GITHUB_OWNER')
    const repo = Deno.env.get('GITHUB_REPO')
    const branch = Deno.env.get('GITHUB_BRANCH') || 'main'
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (!owner || !repo || !githubToken) return json({ error: 'GitHub is not configured on the server.' }, 500)

    const { data: pending, error: fetchError } = await supabase
      .from('resources')
      .select('id, path')
      .is('file_size_bytes', null)
      .not('path', 'is', null)

    if (fetchError) return json({ error: fetchError.message }, 500)

    let updated = 0
    let skipped = 0
    const failures = []
    let sampleError = null

    await runBatch(pending || [], async (row) => {
      const repoPath = repoPathFromUrl(row.path, owner, repo, branch)
      if (!repoPath) {
        skipped += 1
        return
      }
      const { size, error: sizeError } = await fetchSize(owner, repo, branch, repoPath, githubToken)
      if (size == null) {
        failures.push(row.id)
        if (!sampleError) sampleError = sizeError
        return
      }
      const { error: updateError } = await supabase
        .from('resources')
        .update({ file_size_bytes: size })
        .eq('id', row.id)
      if (updateError) {
        failures.push(row.id)
        if (!sampleError) sampleError = updateError.message
      } else {
        updated += 1
      }
    }, CONCURRENCY)

    return json({ total: (pending || []).length, updated, skipped, failed: failures.length, failedIds: failures, sampleError })
  } catch (err) {
    return json({ error: err.message || 'Unexpected error.' }, 500)
  }
})
