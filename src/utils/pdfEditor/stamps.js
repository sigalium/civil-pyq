export const STAMP_POSITIONS = [
  { value: 'bottom-center', label: 'Bottom centre' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'top-right', label: 'Top right' },
]

export const STAMP_FORMATS = [
  { value: 'number', label: '1' },
  { value: 'page', label: 'Page 1' },
  { value: 'of', label: '1 / N' },
]

export const WATERMARK_OPACITIES = [
  { key: 'light', label: 'Light', value: 0.15 },
  { key: 'medium', label: 'Medium', value: 0.25 },
  { key: 'strong', label: 'Strong', value: 0.4 },
]

export const DEFAULT_STAMPS = {
  numbers: { enabled: false, position: 'bottom-center', format: 'number' },
  watermark: { enabled: false, text: '', opacity: 'light' },
}

export const sanitizeWatermark = (text) => [...text].filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 0xff).join('').slice(0, 40)

export const stampsActive = (stamps) => stamps.numbers.enabled || (stamps.watermark.enabled && stamps.watermark.text.trim().length > 0)

export function computeStamps({ width, height, index, total, stamps, measure }) {
  const list = []

  if (stamps.numbers.enabled) {
    const n = index + 1
    const text = stamps.numbers.format === 'page' ? `Page ${n}` : stamps.numbers.format === 'of' ? `${n} / ${total}` : `${n}`
    const size = Math.min(14, Math.max(8, Math.min(width, height) * 0.02))
    const margin = size * 2.2
    const textWidth = measure(text, size)
    const position = stamps.numbers.position
    let x = (width - textWidth) / 2
    let y = height - margin
    if (position === 'bottom-right') x = width - margin - textWidth
    if (position === 'bottom-left') x = margin
    if (position === 'top-right') {
      x = width - margin - textWidth
      y = margin + size
    }
    list.push({ kind: 'number', text, x, y, size, rotateCcw: 0, opacity: 1, color: '#444444' })
  }

  const watermarkText = stamps.watermark.text.trim()
  if (stamps.watermark.enabled && watermarkText) {
    const unit = measure(watermarkText, 1)
    const diagonal = Math.hypot(width, height)
    const size = Math.min((0.7 * diagonal) / Math.max(0.1, unit), 0.18 * Math.min(width, height))
    const textWidth = unit * size
    const angle = Math.PI / 4
    const dirX = Math.cos(angle)
    const dirY = -Math.sin(angle)
    const downX = Math.sin(angle)
    const downY = Math.cos(angle)
    const opacity = WATERMARK_OPACITIES.find((item) => item.key === stamps.watermark.opacity)?.value ?? 0.15
    list.push({
      kind: 'watermark',
      text: watermarkText,
      x: width / 2 - dirX * (textWidth / 2) + downX * size * 0.3,
      y: height / 2 - dirY * (textWidth / 2) + downY * size * 0.3,
      size,
      rotateCcw: 45,
      opacity,
      color: '#6b7280',
    })
  }
  return list
}

export function drawStampsOnCanvas(context, list, scale) {
  list.forEach((stamp) => {
    context.save()
    context.globalAlpha = stamp.opacity
    context.fillStyle = stamp.color
    context.translate(stamp.x * scale, stamp.y * scale)
    context.rotate((-stamp.rotateCcw * Math.PI) / 180)
    context.font = `${stamp.size * scale}px Helvetica, Arial, sans-serif`
    context.textBaseline = 'alphabetic'
    context.fillText(stamp.text, 0, 0)
    context.restore()
  })
}
