const LOCAL_ID_KEY = 'civilpyq-local-id'

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getLocalId() {
  if (typeof window === 'undefined') return null
  try {
    let id = window.localStorage.getItem(LOCAL_ID_KEY)
    if (!id) {
      id = generateId()
      window.localStorage.setItem(LOCAL_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}
