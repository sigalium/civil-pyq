import { degrees, rgb } from 'pdf-lib'
import { rotatePoint } from './annotations.js'

function parseColor(hex) {
  const value = hex.replace('#', '')
  return rgb(parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255)
}

export function drawVectorStamps(target, list, { box, crop, visibleW, visibleH, rotationDeg, font }) {
  list.forEach((stamp) => {
    const fx = (crop ? crop.x : 0) + (stamp.x / visibleW) * (crop ? crop.w : 1)
    const fy = (crop ? crop.y : 0) + (stamp.y / visibleH) * (crop ? crop.h : 1)
    const upright = rotatePoint({ x: fx, y: fy }, -(rotationDeg / 90))
    target.drawText(stamp.text, {
      x: box.x + upright.x * box.width,
      y: box.y + (1 - upright.y) * box.height,
      size: stamp.size,
      font,
      color: parseColor(stamp.color),
      opacity: stamp.opacity,
      rotate: degrees(rotationDeg + stamp.rotateCcw),
    })
  })
}
