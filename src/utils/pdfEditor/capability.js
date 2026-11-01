export const MOBILE_MAX_EDIT_BYTES = 40 * 1024 * 1024
export const MAX_EDITOR_PAGES = 400

export function editorSupported() {
  if (typeof window === 'undefined') return false
  const hasApis =
    typeof Worker !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    typeof ResizeObserver !== 'undefined' &&
    typeof IntersectionObserver !== 'undefined'
  const memoryOk = typeof navigator.deviceMemory !== 'number' || navigator.deviceMemory >= 2
  return hasApis && memoryOk
}

export const isTouchDevice = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches

export function editorAllowedFor(file) {
  if (!editorSupported()) return false
  if (isTouchDevice() && file && file.size > MOBILE_MAX_EDIT_BYTES) return false
  return true
}
