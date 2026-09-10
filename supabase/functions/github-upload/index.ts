import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_PREFIXES = ['pdfs/', 'Contributor/']
const MAX_CONTENT_BASE64_LENGTH = 34_000_000

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return json({ error: 'Missing authorization token.' }, 401)
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    )
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData?.user?.email) {
      return json({ error: 'Not authenticated.' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const { data: admin } = await supabase
      .from('admins')
      .select('role, can_review_submissions, can_edit_resources, can_manage_contributors')
      .eq('email', userData.user.email)
      .maybeSingle()

    const isAllowed = !!admin && (
      admin.role === 'owner' ||
      admin.can_review_submissions ||
      admin.can_edit_resources ||
      admin.can_manage_contributors
    )

    if (!isAllowed) {
      return json({ error: 'Not authorized.' }, 403)
    }

    const body = await req.json()
    const { repoPath, contentBase64, commitMessage, purge = true } = body

    if (!repoPath || !contentBase64) {
      return json({ error: 'Missing repoPath or contentBase64.' }, 400)
    }
    if (!isAllowedPath(repoPath)) {
      return json({ error: 'This destination path is not allowed.' }, 400)
    }
    if (contentBase64.length > MAX_CONTENT_BASE64_LENGTH) {
      return json({ error: 'File is too large to publish.' }, 400)
    }

    const owner = Deno.env.get('GITHUB_OWNER')
    const repo = Deno.env.get('GITHUB_REPO')
    const branch = Deno.env.get('GITHUB_BRANCH') || 'main'
    const githubToken = Deno.env.get('GITHUB_TOKEN')

    if (!owner || !repo || !githubToken) {
      return json({ error: 'GitHub is not configured on the server.' }, 500)
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(repoPath)}`
    const ghHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'civil-pyq-dashboard',
    }

    let sha
    const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders })
    if (existing.status === 200) {
      const existingData = await existing.json()
      sha = existingData.sha
    } else if (existing.status !== 404) {
      const errData = await existing.json().catch(() => ({}))
      return json({ error: `GitHub lookup failed: ${errData.message || existing.status}` }, 502)
    }

    const putResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify({
        message: commitMessage || `Update ${repoPath}`,
        content: contentBase64,
        branch,
        sha,
      }),
    })

    if (!putResponse.ok) {
      const errData = await putResponse.json().catch(() => ({}))
      return json({ error: `GitHub push failed: ${errData.message || putResponse.status}` }, 502)
    }

    const jsDelivrUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${repoPath}`

    if (purge) {
      fetch(`https://purge.jsdelivr.net/gh/${owner}/${repo}@${branch}/${encodePath(repoPath)}`, {
        signal: AbortSignal.timeout(4000),
      }).catch(() => {})
    }

    return json({ url: jsDelivrUrl })
  } catch (err) {
    return json({ error: err.message || 'Unexpected error.' }, 500)
  }
})
