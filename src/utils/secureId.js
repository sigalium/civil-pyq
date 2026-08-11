export function createSecureId(keyString) {
  let hash = 0
  for (let i = 0; i < keyString.length; i++) {
    hash = ((hash << 5) - hash) + keyString.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

export function hasSavedPredictorChat(subject) {
  try {
    const savedKey = localStorage.getItem('gemini_api_key') || sessionStorage.getItem('gemini_api_key')
    if (!savedKey) return false
    const secureId = createSecureId(savedKey)
    return !!localStorage.getItem(`predictor_${subject}_${secureId}`)
  } catch {
    return false
  }
}
