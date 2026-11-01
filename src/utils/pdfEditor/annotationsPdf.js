import { BlendMode, LineCapStyle, degrees, rgb } from 'pdf-lib'
import { HIGHLIGHT_ALPHA, HIGHLIGHT_MULTIPLIER, rotatePoint } from './annotations.js'

function parseColor(hex) {
  const value = hex.replace('#', '')
  return rgb(parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255)
}

export function drawVectorAnnotations(page, annotations, { box, baseRotation, baseW, font }) {
  const turns = -(baseRotation / 90)

  const map = (x, y) => {
    const upright = rotatePoint({ x, y }, turns)
    return [box.x + upright.x * box.width, box.y + (1 - upright.y) * box.height]
  }

  const strokePath = (points, color, thickness, options = {}) => {
    const path = points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'} ${px} ${-py}`).join(' ')
    page.drawSvgPath(path, {
      x: 0,
      y: 0,
      borderColor: parseColor(color),
      borderWidth: thickness,
      borderOpacity: options.opacity ?? 1,
      borderLineCap: options.cap ?? LineCapStyle.Round,
      blendMode: options.blend,
    })
  }

  annotations.forEach((annotation) => {
    if (annotation.type === 'pen' || annotation.type === 'highlight') {
      const points = annotation.points.map((point) => map(point[0], point[1]))
      if (points.length === 1) points.push([points[0][0] + 0.01, points[0][1] + 0.01])
      if (annotation.type === 'highlight') {
        strokePath(points, annotation.color, annotation.width * HIGHLIGHT_MULTIPLIER * baseW, {
          opacity: HIGHLIGHT_ALPHA,
          cap: LineCapStyle.Butt,
          blend: BlendMode.Multiply,
        })
      } else {
        strokePath(points, annotation.color, annotation.width * baseW)
      }
    } else if (annotation.type === 'line' || annotation.type === 'arrow') {
      const [x1, y1] = map(annotation.x1, annotation.y1)
      const [x2, y2] = map(annotation.x2, annotation.y2)
      const thickness = annotation.width * baseW
      strokePath([[x1, y1], [x2, y2]], annotation.color, thickness)
      if (annotation.type === 'arrow') {
        const angle = Math.atan2(y2 - y1, x2 - x1)
        const head = Math.max(thickness * 4, baseW * 0.015)
        strokePath(
          [
            [x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45)],
            [x2, y2],
            [x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45)],
          ],
          annotation.color,
          thickness
        )
      }
    } else if (annotation.type === 'rect') {
      const [x1, y1] = map(annotation.x1, annotation.y1)
      const [x2, y2] = map(annotation.x2, annotation.y2)
      strokePath(
        [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]],
        annotation.color,
        annotation.width * baseW
      )
    } else if (annotation.type === 'ellipse') {
      const [x1, y1] = map(annotation.x1, annotation.y1)
      const [x2, y2] = map(annotation.x2, annotation.y2)
      page.drawEllipse({
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        xScale: Math.max(0.5, Math.abs(x2 - x1) / 2),
        yScale: Math.max(0.5, Math.abs(y2 - y1) / 2),
        borderColor: parseColor(annotation.color),
        borderWidth: annotation.width * baseW,
      })
    } else if (annotation.type === 'text') {
      const [x, y] = map(annotation.x, annotation.y)
      page.drawText(annotation.text, {
        x,
        y,
        size: annotation.size * baseW,
        font,
        color: parseColor(annotation.color),
        rotate: degrees(baseRotation - annotation.angle),
      })
    }
  })
}
