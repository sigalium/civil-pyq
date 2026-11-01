const IST = 'Asia/Kolkata'

export function formatIstTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
}

export function formatIstDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatIstDateTime(iso) {
  if (!iso) return ''
  return `${formatIstDate(iso)}, ${formatIstTime(iso)} IST`
}

export function formatIstDay(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short' })
}

export function formatIstShort(iso) {
  if (!iso) return ''
  const day = new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short' })
  return `${day}, ${formatIstTime(iso)}`
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

export function formatSizeKb(kb) {
  if (kb === null || kb === undefined) return ''
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(2)} GB`
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`
  return `${kb} KB`
}
