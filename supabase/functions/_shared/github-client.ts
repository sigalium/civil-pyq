function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function parseTokenExpiry(value) {
  if (!value) return null
  const parsed = Date.parse(value.replace(' UTC', 'Z').replace(' ', 'T'))
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

export function createGithubClient(config, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  const base = `https://api.github.com/repos/${config.owner}/${config.repo}`
  const headers = {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'civil-pyq-history-cleanup',
  }

  async function api(path, init = {}) {
    let lastError
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${base}${path}`, { ...init, headers })
        const retryable = response.status >= 500 || response.status === 429 || (response.status === 403 && response.headers.get('retry-after'))
        if (!retryable || attempt === 2) return response
        const wait = Number(response.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt
        await sleep(Math.min(wait, 15000))
      } catch (error) {
        lastError = error
        await sleep(1000 * 2 ** attempt)
      }
    }
    throw lastError || new Error('GitHub request failed.')
  }

  async function mustOk(response, label) {
    if (response.ok) return response
    const data = await response.json().catch(() => ({}))
    throw new Error(`${label}: ${data.message || response.status}`)
  }

  return {
    async getRepo() {
      const response = await api('')
      if (response.status !== 200) return { status: response.status }
      const data = await response.json()
      return {
        status: 200,
        sizeKb: data.size,
        archived: !!data.archived,
        canPush: !!(data.permissions && data.permissions.push),
        tokenExpiresAt: parseTokenExpiry(response.headers.get('github-authentication-token-expiration')),
      }
    },
    async getBranch(branch) {
      const response = await api(`/branches/${encodeURIComponent(branch)}`)
      if (response.status === 404) return null
      await mustOk(response, 'Reading the branch failed')
      const data = await response.json()
      return { sha: data.commit.sha, protected: !!data.protected }
    },
    async getCommit(sha) {
      const response = await mustOk(await api(`/git/commits/${sha}`), 'Reading the commit failed')
      const data = await response.json()
      return {
        sha: data.sha,
        treeSha: data.tree.sha,
        parents: (data.parents || []).map((parent) => parent.sha),
        committedAt: (data.committer && data.committer.date) || (data.author && data.author.date),
      }
    },
    async createRootCommit({ treeSha, message }) {
      const date = new Date().toISOString()
      const identity = { name: 'CivilPYQ Cleanup', email: 'cleanup@users.noreply.github.com', date }
      const response = await mustOk(
        await api('/git/commits', {
          method: 'POST',
          body: JSON.stringify({ message, tree: treeSha, parents: [], author: identity, committer: identity }),
        }),
        'Creating the commit failed'
      )
      return (await response.json()).sha
    },
    async createRef(ref, sha) {
      await mustOk(await api('/git/refs', { method: 'POST', body: JSON.stringify({ ref, sha }) }), 'Creating the branch failed')
    },
    async updateRef(ref, sha, force) {
      await mustOk(await api(`/git/refs/${ref}`, { method: 'PATCH', body: JSON.stringify({ sha, force }) }), 'Moving the branch failed')
    },
    async deleteRef(ref) {
      const response = await api(`/git/refs/${ref}`, { method: 'DELETE' })
      if (response.status === 204 || response.status === 404 || response.status === 422) return
      await mustOk(response, 'Deleting the branch failed')
    },
    async getRef(ref) {
      const response = await api(`/git/ref/${ref}`)
      if (response.status === 404) return null
      await mustOk(response, 'Reading the branch failed')
      return (await response.json()).object.sha
    },
    async listRefs() {
      const refs = []
      for (const kind of ['heads', 'tags']) {
        const response = await api(`/git/matching-refs/${kind}?per_page=100`)
        if (response.status === 404) continue
        await mustOk(response, 'Listing branches failed')
        const data = await response.json()
        refs.push(...data.map((item) => item.ref))
      }
      return refs
    },
    async recentPushes(sinceIso, branch) {
      const response = await api('/events?per_page=30')
      if (!response.ok) return []
      const events = await response.json()
      return events
        .filter((event) => event.type === 'PushEvent' && event.created_at >= sinceIso && event.payload && event.payload.ref === `refs/heads/${branch}`)
        .map((event) => ({ actor: event.actor && event.actor.login, createdAt: event.created_at }))
    },
    async getFile(path, branch) {
      const response = await api(`/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`)
      if (response.status === 404) return null
      await mustOk(response, 'Reading a file failed')
      const data = await response.json()
      return { size: data.size }
    },
    async checkCdn(path, branch) {
      try {
        const response = await fetch(`https://cdn.jsdelivr.net/gh/${config.owner}/${config.repo}@${branch}/${encodePath(path)}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000),
        })
        return { ok: response.ok, size: Number(response.headers.get('content-length')) || null }
      } catch {
        return { ok: false, size: null }
      }
    },
  }
}
