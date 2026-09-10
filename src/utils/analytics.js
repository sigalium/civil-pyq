import { supabase } from '../lib/supabaseClient'

const DEBOUNCE_MS = 60 * 60 * 1000
const STORAGE_PREFIX = 'pyq_event_'

function shouldLog(key) {
  try {
    const last = Number(localStorage.getItem(STORAGE_PREFIX + key) || 0)
    if (Date.now() - last < DEBOUNCE_MS) return false
    localStorage.setItem(STORAGE_PREFIX + key, String(Date.now()))
    return true
  } catch {
    return true
  }
}

export function logResourceEvent(resourceId, eventType) {
  if (!resourceId || !eventType) return
  const key = `${eventType}:${resourceId}`
  if (!shouldLog(key)) return
  supabase.from('resource_events').insert({ resource_id: resourceId, event_type: eventType }).then(() => {})
}
