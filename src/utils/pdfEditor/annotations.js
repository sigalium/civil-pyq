export const ANNOTATION_COLORS = ['#111111', '#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#facc15']

export const ANNOTATION_SIZES = [
  { key: 'thin', label: 'Thin', value: 0.0025 },
  { key: 'medium', label: 'Medium', value: 0.005 },
  { key: 'thick', label: 'Thick', value: 0.01 },
]

export const HIGHLIGHT_MULTIPLIER = 4
export const HIGHLIGHT_ALPHA = 0.4
export const TEXT_MULTIPLIER = 6
export const FONT_STACK = 'Helvetica, Arial, sans-serif'

let annotationCounter = 0

export const newAnnotationId = () => {
  annotationCounter += 1
  return `an${annotationCounter}`
}

export function rotatePoint(point, quarterTurns) {
  const turns = ((quarterTurns % 4) + 4) % 4
  let x = point.x
  let y = point.y
  for (let i = 0; i < turns; i++) {
    const nextX = 1 - y
    y = x
    x = nextX
  }
  return { x, y }
}

export function hasLatinOnlyText(annotations) {
  return annotations.every((annotation) => annotation.type !== 'text' || [...annotation.text].every((char) => char.charCodeAt(0) <= 0xff))
}

function strokeBaseWidth(annotation) {
  return annotation.type === 'highlight' ? annotation.width * HIGHLIGHT_MULTIPLIER : annotation.width
}

function pathThrough(context, points) {
  context.beginPath()
  context.moveTo(points[0][0], points[0][1])
  if (points.length === 1) {
    context.lineTo(points[0][0] + 0.01, points[0][1] + 0.01)
    return
  }
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i][0] + points[i + 1][0]) / 2
    const midY = (points[i][1] + points[i + 1][1]) / 2
    context.quadraticCurveTo(points[i][0], points[i][1], midX, midY)
  }
  const last = points[points.length - 1]
  context.lineTo(last[0], last[1])
}

export function drawAnnotations(context, annotations, width, height, quarterTurns, options = {}) {
  const blend = options.blend !== false
  const turns = ((quarterTurns % 4) + 4) % 4
  const unit = turns % 2 === 1 ? height : width
  const map = (x, y) => {
    const rotated = rotatePoint({ x, y }, turns)
    return [rotated.x * width, rotated.y * height]
  }

  annotations.forEach((annotation) => {
    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = annotation.color
    context.fillStyle = annotation.color

    if (annotation.type === 'pen' || annotation.type === 'highlight') {
      context.lineWidth = Math.max(1, strokeBaseWidth(annotation) * unit)
      if (annotation.type === 'highlight') {
        context.globalAlpha = HIGHLIGHT_ALPHA
        if (blend) context.globalCompositeOperation = 'multiply'
        context.lineCap = 'butt'
      }
      pathThrough(
        context,
        annotation.points.map((point) => map(point[0], point[1]))
      )
      context.stroke()
    } else if (annotation.type === 'line' || annotation.type === 'arrow') {
      const [x1, y1] = map(annotation.x1, annotation.y1)
      const [x2, y2] = map(annotation.x2, annotation.y2)
      const thickness = Math.max(1, annotation.width * unit)
      context.lineWidth = thickness
      context.beginPath()
      context.moveTo(x1, y1)
      context.lineTo(x2, y2)
      context.stroke()
      if (annotation.type === 'arrow') {
        const angle = Math.atan2(y2 - y1, x2 - x1)
        const head = Math.max(thickness * 4, unit * 0.015)
        context.beginPath()
        context.moveTo(x2, y2)
        context.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45))
        context.moveTo(x2, y2)
        context.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45))
        context.stroke()
      }
    } else if (annotation.type === 'rect' || annotation.type === 'ellipse') {
      const [x1, y1] = map(annotation.x1, annotation.y1)
      const [x2, y2] = map(annotation.x2, annotation.y2)
      const left = Math.min(x1, x2)
      const top = Math.min(y1, y2)
      const boxWidth = Math.abs(x2 - x1)
      const boxHeight = Math.abs(y2 - y1)
      context.lineWidth = Math.max(1, annotation.width * unit)
      if (annotation.type === 'rect') {
        context.strokeRect(left, top, boxWidth, boxHeight)
      } else {
        context.beginPath()
        context.ellipse(left + boxWidth / 2, top + boxHeight / 2, boxWidth / 2, boxHeight / 2, 0, 0, Math.PI * 2)
        context.stroke()
      }
    } else if (annotation.type === 'text') {
      const [x, y] = map(annotation.x, annotation.y)
      context.translate(x, y)
      context.rotate(((annotation.angle + turns * 90) * Math.PI) / 180)
      context.font = `${annotation.size * unit}px ${FONT_STACK}`
      context.textBaseline = 'alphabetic'
      context.fillText(annotation.text, 0, 0)
    }
    context.restore()
  })
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function annotationHit(annotation, point, radius, page) {
  const scaleX = page.baseW
  const scaleY = page.baseH
  const px = point.x * scaleX
  const py = point.y * scaleY
  const reach = radius + (strokeBaseWidth(annotation) || 0) * scaleX * 0.5

  if (annotation.type === 'pen' || annotation.type === 'highlight') {
    const pts = annotation.points
    if (pts.length === 1) return Math.hypot(px - pts[0][0] * scaleX, py - pts[0][1] * scaleY) <= reach
    for (let i = 0; i < pts.length - 1; i++) {
      if (distanceToSegment(px, py, pts[i][0] * scaleX, pts[i][1] * scaleY, pts[i + 1][0] * scaleX, pts[i + 1][1] * scaleY) <= reach) return true
    }
    return false
  }
  if (annotation.type === 'line' || annotation.type === 'arrow') {
    return distanceToSegment(px, py, annotation.x1 * scaleX, annotation.y1 * scaleY, annotation.x2 * scaleX, annotation.y2 * scaleY) <= reach
  }
  if (annotation.type === 'rect' || annotation.type === 'ellipse') {
    const left = Math.min(annotation.x1, annotation.x2) * scaleX
    const right = Math.max(annotation.x1, annotation.x2) * scaleX
    const top = Math.min(annotation.y1, annotation.y2) * scaleY
    const bottom = Math.max(annotation.y1, annotation.y2) * scaleY
    if (annotation.type === 'rect') {
      const inside = px >= left - reach && px <= right + reach && py >= top - reach && py <= bottom + reach
      const innerInside = px > left + reach && px < right - reach && py > top + reach && py < bottom - reach
      return inside && !innerInside
    }
    const cx = (left + right) / 2
    const cy = (top + bottom) / 2
    const rx = Math.max(1, (right - left) / 2)
    const ry = Math.max(1, (bottom - top) / 2)
    const value = Math.hypot((px - cx) / rx, (py - cy) / ry)
    const tolerance = reach / Math.min(rx, ry)
    return Math.abs(value - 1) <= tolerance
  }
  if (annotation.type === 'text') {
    const size = annotation.size * scaleX
    const length = annotation.text.length * size * 0.55
    const radians = (annotation.angle * Math.PI) / 180
    const dx = px - annotation.x * scaleX
    const dy = py - annotation.y * scaleY
    const localX = dx * Math.cos(radians) + dy * Math.sin(radians)
    const localY = -dx * Math.sin(radians) + dy * Math.cos(radians)
    return localX >= -radius && localX <= length + radius && localY >= -size - radius && localY <= size * 0.3 + radius
  }
  return false
}
