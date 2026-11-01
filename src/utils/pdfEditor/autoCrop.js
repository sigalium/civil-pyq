function otsuThreshold(lum) {
  const histogram = new Float64Array(256)
  for (let i = 0; i < lum.length; i++) histogram[Math.min(255, Math.max(0, Math.round(lum[i])))] += 1
  const total = lum.length
  let sumAll = 0
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i]
  let weightBack = 0
  let sumBack = 0
  let best = 0
  let bestVariance = -1
  for (let t = 0; t < 256; t++) {
    weightBack += histogram[t]
    if (weightBack === 0) continue
    const weightFore = total - weightBack
    if (weightFore === 0) break
    sumBack += t * histogram[t]
    const meanBack = sumBack / weightBack
    const meanFore = (sumAll - sumBack) / weightFore
    const variance = weightBack * weightFore * (meanBack - meanFore) * (meanBack - meanFore)
    if (variance > bestVariance) {
      bestVariance = variance
      best = t
    }
  }
  return best
}

function boxBlur(lum, width, height) {
  const out = new Float32Array(lum.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let total = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          total += lum[ny * width + nx]
          count += 1
        }
      }
      out[y * width + x] = total / count
    }
  }
  return out
}

function largestComponent(mask, width, height) {
  const labels = new Int32Array(mask.length)
  const stack = new Int32Array(mask.length)
  let bestLabel = 0
  let bestSize = 0
  let label = 0
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue
    label += 1
    let size = 0
    let top = 0
    stack[top++] = start
    labels[start] = label
    while (top > 0) {
      const index = stack[--top]
      size += 1
      const x = index % width
      const y = (index - x) / width
      if (x > 0 && mask[index - 1] && !labels[index - 1]) {
        labels[index - 1] = label
        stack[top++] = index - 1
      }
      if (x < width - 1 && mask[index + 1] && !labels[index + 1]) {
        labels[index + 1] = label
        stack[top++] = index + 1
      }
      if (y > 0 && mask[index - width] && !labels[index - width]) {
        labels[index - width] = label
        stack[top++] = index - width
      }
      if (y < height - 1 && mask[index + width] && !labels[index + width]) {
        labels[index + width] = label
        stack[top++] = index + width
      }
    }
    if (size > bestSize) {
      bestSize = size
      bestLabel = label
    }
  }
  return { labels, bestLabel, bestSize }
}

function detectInImage(imageData) {
  const { data, width, height } = imageData
  const count = width * height
  const raw = new Float32Array(count)
  for (let i = 0; i < count; i++) raw[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  const lum = boxBlur(raw, width, height)
  const threshold = otsuThreshold(lum)
  const mask = new Uint8Array(count)
  let bright = 0
  for (let i = 0; i < count; i++) {
    if (lum[i] > threshold) {
      mask[i] = 1
      bright += 1
    }
  }
  const coverage = bright / count
  if (coverage > 0.93 || coverage < 0.15) return null

  const { labels, bestLabel, bestSize } = largestComponent(mask, width, height)
  if (!bestLabel || bestSize / count < 0.15) return null

  const rows = new Int32Array(height)
  const cols = new Int32Array(width)
  for (let i = 0; i < count; i++) {
    if (labels[i] === bestLabel) {
      rows[Math.floor(i / width)] += 1
      cols[i % width] += 1
    }
  }
  const rowLimit = Math.max(...rows) * 0.12
  const colLimit = Math.max(...cols) * 0.12
  let top = 0
  let bottom = height - 1
  let left = 0
  let right = width - 1
  while (top < height - 1 && rows[top] < rowLimit) top += 1
  while (bottom > top && rows[bottom] < rowLimit) bottom -= 1
  while (left < width - 1 && cols[left] < colLimit) left += 1
  while (right > left && cols[right] < colLimit) right -= 1

  const pad = 0.01
  const rect = {
    x: Math.max(0, left / width - pad),
    y: Math.max(0, top / height - pad),
    w: 0,
    h: 0,
  }
  rect.w = Math.min(1 - rect.x, (right + 1) / width + pad - rect.x)
  rect.h = Math.min(1 - rect.y, (bottom + 1) / height + pad - rect.y)

  if (rect.w * rect.h < 0.3) return null
  if (rect.w > 0.97 && rect.h > 0.97) return null
  return rect
}

function flatWhiteRegion(data, width, height) {
  const isFlat = (i) => data[i] >= 250 && data[i + 1] >= 250 && data[i + 2] >= 250
  const rowFlat = new Uint8Array(height)
  for (let y = 0; y < height; y++) {
    let flat = 0
    for (let x = 0; x < width; x++) if (isFlat((y * width + x) * 4)) flat += 1
    rowFlat[y] = flat >= width * 0.99 ? 1 : 0
  }
  let top = 0
  while (top < height && rowFlat[top]) top += 1
  if (top >= height) return null
  let bottom = height - 1
  while (bottom > top && rowFlat[bottom]) bottom -= 1

  const colFlat = new Uint8Array(width)
  const rows = bottom - top + 1
  for (let x = 0; x < width; x++) {
    let flat = 0
    for (let y = top; y <= bottom; y++) if (isFlat((y * width + x) * 4)) flat += 1
    colFlat[x] = flat >= rows * 0.99 ? 1 : 0
  }
  let left = 0
  while (left < width && colFlat[left]) left += 1
  if (left >= width) return null
  let right = width - 1
  while (right > left && colFlat[right]) right -= 1

  return { x0: left, y0: top, x1: right + 1, y1: bottom + 1 }
}

function darkShare(data, width, region) {
  const isDark = (x, y) => {
    const i = (y * width + x) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 100
  }
  let dark = 0
  let total = 0
  for (let y = region.y0; y < region.y1; y++) {
    for (let x = region.x0; x < region.x1; x++) {
      if (isDark(x, y)) dark += 1
      total += 1
    }
  }
  let edgeDark = 0
  let edgeTotal = 0
  for (let x = region.x0; x < region.x1; x++) {
    edgeDark += (isDark(x, region.y0) ? 1 : 0) + (isDark(x, region.y1 - 1) ? 1 : 0)
    edgeTotal += 2
  }
  for (let y = region.y0; y < region.y1; y++) {
    edgeDark += (isDark(region.x0, y) ? 1 : 0) + (isDark(region.x1 - 1, y) ? 1 : 0)
    edgeTotal += 2
  }
  return { inside: total ? dark / total : 0, edge: edgeTotal ? edgeDark / edgeTotal : 0 }
}

function cropImageData(data, width, region) {
  const w = region.x1 - region.x0
  const h = region.y1 - region.y0
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const start = ((y + region.y0) * width + region.x0) * 4
    out.set(data.subarray(start, start + w * 4), y * w * 4)
  }
  return { data: out, width: w, height: h }
}

export function detectDocumentRect(imageData) {
  const { data, width, height } = imageData
  const region = flatWhiteRegion(data, width, height)
  const regionArea = region ? ((region.x1 - region.x0) * (region.y1 - region.y0)) / (width * height) : 1
  const dark = region ? darkShare(data, width, region) : null
  if (!region || regionArea > 0.75 || dark.inside < 0.15 || dark.edge < 0.25) return detectInImage(imageData)

  const found = detectInImage(cropImageData(data, width, region))
  if (!found) return null
  const regionW = region.x1 - region.x0
  const regionH = region.y1 - region.y0
  const rect = {
    x: (region.x0 + found.x * regionW) / width,
    y: (region.y0 + found.y * regionH) / height,
    w: (found.w * regionW) / width,
    h: (found.h * regionH) / height,
  }
  if (rect.w > 0.97 && rect.h > 0.97) return null
  return rect
}
