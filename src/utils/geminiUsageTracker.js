import { createSecureId } from './secureId'

const STORAGE_PREFIX = 'gemini_usage_'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function storageKey(apiKey) {
  return `${STORAGE_PREFIX}${createSecureId(apiKey)}`
}

export function recordGeminiRequest(apiKey) {
  if (!apiKey) return
  try {
    const key = storageKey(apiKey)
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : { date: todayKey(), count: 0 }
    if (parsed.date !== todayKey()) {
      parsed.date = todayKey()
      parsed.count = 0
    }
    parsed.count += 1
    localStorage.setItem(key, JSON.stringify(parsed))
  } catch {
    return
  }
}

export function getGeminiUsageToday(apiKey) {
  if (!apiKey) return 0
  try {
    const key = storageKey(apiKey)
    const raw = localStorage.getItem(key)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    if (parsed.date !== todayKey()) return 0
    return parsed.count || 0
  } catch {
    return 0
  }
}
