import { supabase } from '../lib/supabaseClient'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-upload`
const MAX_FILE_BYTES = 25 * 1024 * 1024

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'))
    reader.readAsDataURL(file)
  })
}

export function sanitizePathSegment(value) {
  return (value || '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
}

export function getFileExtension(fileName) {
  const parts = (fileName || '').split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : 'pdf'
}

export async function uploadFileToGithub({ file, repoPath, commitMessage }) {
  if (!file) throw new Error('No file selected.')
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File is larger than 25MB. Please upload a smaller file.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('You need to be signed in to publish files.')

  const contentBase64 = await fileToBase64(file)

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ repoPath, contentBase64, commitMessage }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'Upload failed.')
  }
  return result.url
}

const DELETE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-delete`

export async function deleteFileFromGithub({ repoPath, commitMessage }) {
  if (!repoPath) return
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('You need to be signed in to delete files.')

  const response = await fetch(DELETE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ repoPath, commitMessage }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'File deletion failed.')
  }
  return result
}
