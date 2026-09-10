import { supabase } from '../lib/supabaseClient'
import { persistOrder } from './resourceOrdering'

export async function insertCodeOnTop({ name, path, file_size_bytes, section_id, description }) {
  let query = supabase
    .from('resources')
    .select('id, sort_order')
    .eq('resource_type', 'iscode')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  query = section_id ? query.eq('section_id', section_id) : query.is('section_id', null)
  const { data: existing } = await query

  const { data: inserted, error } = await supabase
    .from('resources')
    .insert({ resource_type: 'iscode', name, path, file_size_bytes, section_id: section_id || null, description: description || null, semester: null, subject: null, sort_order: 0 })
    .select('id')
    .single()

  if (error) throw error

  const items = [{ id: inserted.id, sort_order: 0 }, ...(existing || [])]
  await persistOrder('resources', items)
  return inserted.id
}
