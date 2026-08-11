import { supabase } from '../lib/supabaseClient'

export async function persistOrder(table, items) {
  const updates = items
    .map((item, index) => {
      const id = typeof item === 'string' ? item : item.id
      const prevOrder = typeof item === 'string' ? undefined : item.sort_order
      return { id, index, changed: prevOrder === undefined || prevOrder !== index }
    })
    .filter((entry) => entry.changed)

  await Promise.all(updates.map(({ id, index }) => supabase.from(table).update({ sort_order: index }).eq('id', id)))
}

export async function moveResourceToTop({ id, semester, subject, resource_type, path }) {
  if (resource_type === 'syllabus') {
    await supabase
      .from('resources')
      .delete()
      .eq('semester', semester)
      .eq('subject', subject)
      .eq('resource_type', 'syllabus')
      .neq('id', id)
  }

  const { data: existing } = await supabase
    .from('resources')
    .select('id, sort_order')
    .eq('semester', semester)
    .eq('subject', subject)
    .eq('resource_type', resource_type)
    .is('deleted_at', null)
    .neq('id', id)
    .order('sort_order', { ascending: true })

  const updatePayload = { semester, subject, resource_type, sort_order: 0 }
  if (path) updatePayload.path = path
  await supabase.from('resources').update(updatePayload).eq('id', id)

  const items = [{ id, sort_order: 0 }, ...(existing || [])]
  await persistOrder('resources', items)
}

export async function insertResourceOnTop({ semester, subject, resource_type, name, path }) {
  const { data: existing } = await supabase
    .from('resources')
    .select('id, sort_order')
    .eq('semester', semester)
    .eq('subject', subject)
    .eq('resource_type', resource_type)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  const { data: inserted, error } = await supabase
    .from('resources')
    .insert({ semester, subject, resource_type, name, path, sort_order: 0 })
    .select('id')
    .single()

  if (error) throw error

  const items = [{ id: inserted.id, sort_order: 0 }, ...(existing || [])]
  await persistOrder('resources', items)
  return inserted.id
}