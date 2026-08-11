import { supabase } from '../lib/supabaseClient'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate-file`

export async function migrateFileInGithub({ oldPath, newPath }) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('You need to be signed in to migrate files.')

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ oldPath, newPath }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'Migration failed.')
  }
  return result
}
