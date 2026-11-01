import { buildContributorPhotoUrl, extractRepoPathFromUrl } from './resourceSnippet'
import { recordReplacedFile } from './replacedFiles'

export function getCustomPhotoRepoPath(profilePic) {
  if (!profilePic) return null
  const repoPath = extractRepoPathFromUrl(buildContributorPhotoUrl(profilePic))
  if (!repoPath || !repoPath.startsWith('Contributor/') || repoPath.startsWith('Contributor/Default/')) return null
  return repoPath
}

export async function trackAbandonedPhoto(profilePic, contributorName) {
  if (!getCustomPhotoRepoPath(profilePic)) return
  await recordReplacedFile({
    oldUrl: buildContributorPhotoUrl(profilePic),
    resourceName: `${contributorName || 'Contributor'} (contributor photo)`,
    resourceType: 'contributor photo',
  })
}

export async function downloadContributorPhoto(profilePic, contributorName) {
  const url = buildContributorPhotoUrl(profilePic)
  const repoPath = getCustomPhotoRepoPath(profilePic)
  const fileName = repoPath ? repoPath.split('/').pop() : `${contributorName || 'photo'}.png`
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Download failed')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}
