import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_PREFIXES = ['pdfs/', 'Contributor/']

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
      .select('role')
      .eq('email', userData.user.email)
      .maybeSingle()

    if (!admin || admin.role !== 'owner') {
      return json({ error: 'Only the owner can permanently delete files.' }, 403)
    }

    const body = await req.json()
    const { repoPath, commitMessage } = body

    if (!repoPath) {
      return json({ error: 'Missing repoPath.' }, 400)
    }
    if (!isAllowedPath(repoPath)) {
      return json({ error: 'This path is not allowed.' }, 400)
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

    const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders })
    if (existing.status === 404) {
      return json({ ok: true, note: 'File was already gone from GitHub.' })
    }
    if (existing.status !== 200) {
      const errData = await existing.json().catch(() => ({}))
      return json({ error: `GitHub lookup failed: ${errData.message || existing.status}` }, 502)
    }
    const existingData = await existing.json()

    const deleteResponse = await fetch(apiUrl, {
      method: 'DELETE',
      headers: ghHeaders,
      body: JSON.stringify({
        message: commitMessage || `Delete ${repoPath}`,
        sha: existingData.sha,
        branch,
      }),
    })

    if (!deleteResponse.ok) {
      const errData = await deleteResponse.json().catch(() => ({}))
      return json({ error: `GitHub delete failed: ${errData.message || deleteResponse.status}` }, 502)
    }

    fetch(`https://purge.jsdelivr.net/gh/${owner}/${repo}@${branch}/${encodePath(repoPath)}`, {
      signal: AbortSignal.timeout(4000),
    }).catch(() => {})

    return json({ ok: true })
  } catch (err) {
    return json({ error: err.message || 'Unexpected error.' }, 500)
  }
})
