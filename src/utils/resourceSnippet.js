const JSDELIVR_OWNER = import.meta.env.VITE_JSDELIVR_OWNER || 'YOUR_GITHUB_USERNAME'
const JSDELIVR_REPO = import.meta.env.VITE_JSDELIVR_REPO || 'civilpyq-data'
const JSDELIVR_BRANCH = import.meta.env.VITE_JSDELIVR_BRANCH || 'main'

export const DEFAULT_AVATARS = [
  { file: 'female01.png', label: 'Female 1' },
  { file: 'female02.png', label: 'Female 2' },
  { file: 'female03.png', label: 'Female 3' },
  { file: 'female04.png', label: 'Female 4' },
  { file: 'female05.png', label: 'Female 5' },
  { file: 'jane.png', label: 'Jane' },
  { file: 'john.png', label: 'John' },
  { file: 'male01.png', label: 'Male 1' },
  { file: 'male02.png', label: 'Male 2' },
  { file: 'male03.png', label: 'Male 3' },
  { file: 'male04.png', label: 'Male 4' },
  { file: 'male05.png', label: 'Male 5' },
]

export function buildDefaultAvatarUrl(fileName) {
  return `https://cdn.jsdelivr.net/gh/${JSDELIVR_OWNER}/${JSDELIVR_REPO}@${JSDELIVR_BRANCH}/Contributor/Default/${fileName}`
}

export function buildContributorPhotoUrl(profilePic) {
  if (!profilePic) return profilePic
  if (/^https?:\/\//i.test(profilePic)) return profilePic
  const cleanPath = profilePic.startsWith('/') ? profilePic.slice(1) : profilePic
  return `https://cdn.jsdelivr.net/gh/${JSDELIVR_OWNER}/${JSDELIVR_REPO}@${JSDELIVR_BRANCH}/${cleanPath}`
}

function sanitizeSegment(value) {
  return value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
}

function getExtension(fileName) {
  const parts = (fileName || '').split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : 'pdf'
}

export function buildJsDelivrUrl(submission) {
  const base = `https://cdn.jsdelivr.net/gh/${JSDELIVR_OWNER}/${JSDELIVR_REPO}@${JSDELIVR_BRANCH}/pdfs/Semester${submission.semester}/${submission.subject}`
  if (submission.resource_type === 'syllabus') {
    return `${base}/Syllabus.pdf`
  }
  const extension = getExtension(submission.file_path)
  const filename = sanitizeSegment(submission.resource_label) || 'Untitled'
  return `${base}/${filename}.${extension}`
}

export function buildStagingRepoPath(submission) {
  const url = buildJsDelivrUrl(submission)
  const marker = `@${JSDELIVR_BRANCH}/`
  const index = url.indexOf(marker)
  return index === -1 ? url : url.slice(index + marker.length)
}

export function extractRepoPathFromUrl(url) {
  if (!url) return null
  const marker = `@${JSDELIVR_BRANCH}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : url.slice(index + marker.length)
}
