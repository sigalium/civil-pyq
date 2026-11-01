import { supabase } from '../lib/supabaseClient'

export const normalizeContributorName = (value) => (value || '').replace(/\s+/g, ' ').trim()

export const contributorNameKey = (value) => normalizeContributorName(value).toLowerCase()

export async function recordSubmissionContributor(name) {
  const clean = normalizeContributorName(name)
  if (!clean || clean.toLowerCase() === 'anonymous') return
  try {
    await supabase.rpc('record_submission_contributor', { p_name: clean })
  } catch {
    return
  }
}
