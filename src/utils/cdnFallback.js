const JSDELIVR_GITHUB = /^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^/@]+)@([^/]+)\/(.+)$/

export function toRawGithubUrl(url) {
  if (typeof url !== 'string') return null
  const match = JSDELIVR_GITHUB.exec(url)
  if (!match) return null
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}`
}

export async function fetchWithFallback(url, options) {
  const fallbackUrl = toRawGithubUrl(url)
  try {
    const response = await fetch(url, options)
    if (response.ok || !fallbackUrl) return response
  } catch (error) {
    if (!fallbackUrl) throw error
  }
  return fetch(fallbackUrl, options)
}
