const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export function isoToIstParts(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const shifted = new Date(date.getTime() + IST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour24: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

export function istPartsToIso({ year, month, day, hour24, minute }) {
  const utcMs = Date.UTC(year, month - 1, day, hour24, minute, 0) - IST_OFFSET_MS
  return new Date(utcMs).toISOString()
}

export function formatIstDisplay(iso) {
  const parts = isoToIstParts(iso)
  if (!parts) return ''
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hour12 = parts.hour24 % 12 === 0 ? 12 : parts.hour24 % 12
  const ampm = parts.hour24 < 12 ? 'AM' : 'PM'
  const minute = String(parts.minute).padStart(2, '0')
  return `${String(parts.day).padStart(2, '0')} ${monthNames[parts.month - 1]} ${parts.year}, ${hour12}:${minute} ${ampm} IST`
}
