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
      .select('role, can_edit_resources')
      .eq('email', userData.user.email)
      .maybeSingle()

    const isAllowed = !!admin && (admin.role === 'owner' || admin.can_edit_resources)
    if (!isAllowed) {
      return json({ error: 'Not authorized.' }, 403)
    }

    const body = await req.json()
    const { oldPath, newPath } = body

    if (!oldPath || !newPath) {
      return json({ error: 'Missing oldPath or newPath.' }, 400)
    }
    if (!isAllowedPath(oldPath) || !isAllowedPath(newPath)) {
      return json({ error: 'This path is not allowed.' }, 400)
    }
    if (oldPath === newPath) {
      return json({ error: 'Source and destination are the same.' }, 400)
    }

    const owner = Deno.env.get('GITHUB_OWNER')
    const repo = Deno.env.get('GITHUB_REPO')
    const branch = Deno.env.get('GITHUB_BRANCH') || 'main'
    const githubToken = Deno.env.get('GITHUB_TOKEN')

    if (!owner || !repo || !githubToken) {
      return json({ error: 'GitHub is not configured on the server.' }, 500)
    }

    const ghHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'civil-pyq-dashboard',
    }

    const oldUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(oldPath)}`
    const getRes = await fetch(`${oldUrl}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders })

    if (!getRes.ok) {
      const errData = await getRes.json().catch(() => ({}))
      return json({ error: `Could not read the source file: ${errData.message || getRes.status}` }, 502)
    }

    const fileData = await getRes.json()
    const oldSha = fileData.sha
    const content = fileData.content

    const newUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(newPath)}`
    let newSha
    const checkNew = await fetch(`${newUrl}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders })
    if (checkNew.status === 200) {
      const existingData = await checkNew.json()
      newSha = existingData.sha
    } else if (checkNew.status !== 404) {
      const errData = await checkNew.json().catch(() => ({}))
      return json({ error: `GitHub lookup failed: ${errData.message || checkNew.status}` }, 502)
    }

    const putRes = await fetch(newUrl, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify({
        message: `Migrate ${oldPath} to ${newPath}`,
        content,
        branch,
        sha: newSha,
      }),
    })

    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}))
      return json({ error: `Could not create the file at the new location: ${errData.message || putRes.status}` }, 502)
    }

    const deleteRes = await fetch(oldUrl, {
      method: 'DELETE',
      headers: ghHeaders,
      body: JSON.stringify({
        message: `Remove ${oldPath} after migrating to ${newPath}`,
        sha: oldSha,
        branch,
      }),
    })

    let deleteWarning
    if (!deleteRes.ok) {
      const errData = await deleteRes.json().catch(() => ({}))
      deleteWarning = `File was copied to the new location, but the old file could not be removed: ${errData.message || deleteRes.status}`
    }

    const jsDelivrUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${newPath}`

    try {
      await fetch(`https://purge.jsdelivr.net/gh/${owner}/${repo}@${branch}/${encodePath(newPath)}`)
      await fetch(`https://purge.jsdelivr.net/gh/${owner}/${repo}@${branch}/${encodePath(oldPath)}`)
    } catch (_purgeError) {
    }

    return json({ url: jsDelivrUrl, warning: deleteWarning })
  } catch (err) {
    return json({ error: err.message || 'Unexpected error.' }, 500)
  }
})
