export const A4_WIDTH = 595
export const A4_HEIGHT = 842

export const normalizeDeg = (degrees) => ((degrees % 360) + 360) % 360

export function rotateRect(rect, quarterTurns) {
  const turns = ((quarterTurns % 4) + 4) % 4
  let current = rect
  for (let i = 0; i < turns; i++) {
    current = { x: 1 - current.y - current.h, y: current.x, w: current.h, h: current.w }
  }
  return current
}

export function displayDims(page) {
  const sideways = (page.rotation / 90) % 2 === 1
  return sideways ? { w: page.baseH, h: page.baseW } : { w: page.baseW, h: page.baseH }
}

export function totalRotation(page) {
  return page.kind === 'pdf' ? normalizeDeg(page.baseRotation + page.rotation) : normalizeDeg(page.rotation)
}

export function pageRenderRotation(page, withUserRotation) {
  const user = withUserRotation ? page.rotation : 0
  return page.kind === 'pdf' ? normalizeDeg(page.baseRotation + user) : normalizeDeg(user)
}

export function cropToPdfBox(box, crop, rotationDeg) {
  const upright = rotateRect(crop, -(normalizeDeg(rotationDeg) / 90))
  return {
    x: box.x + upright.x * box.width,
    y: box.y + (1 - upright.y - upright.h) * box.height,
    width: upright.w * box.width,
    height: upright.h * box.height,
  }
}

export const isFullCrop = (rect) => rect.x <= 0.002 && rect.y <= 0.002 && rect.w >= 0.996 && rect.h >= 0.996

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
