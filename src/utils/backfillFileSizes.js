import { supabase } from '../lib/supabaseClient'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backfill-file-sizes`

export async function backfillFileSizes() {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('You need to be signed in to run this.')

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'Backfill failed.')
  }
  return result
}
