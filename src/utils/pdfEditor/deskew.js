import { buildSampler, estimateBackground } from './filters.js'

const MAX_POINTS = 30000
const SEARCH_LIMIT = 10

function collectInk(imageData) {
  const { data, width, height } = imageData
  const background = estimateBackground(data, width, height)
  const rowAt = buildSampler(background, width)
  const { grid, cols, rows, block } = background
  const edge = new Uint8Array(cols * rows)
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const value = grid[by * cols + bx]
      for (let dy = -2; dy <= 2 && !edge[by * cols + bx]; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = bx + dx
          const ny = by + dy
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          if (grid[ny * cols + nx] < value * 0.8) {
            edge[by * cols + bx] = 1
            break
          }
        }
      }
    }
  }
  const xs = []
  const ys = []
  for (let y = 0; y < height; y++) {
    const bgRow = rowAt(y)
    const blockRow = Math.floor(y / block) * cols
    for (let x = 0; x < width; x++) {
      if (edge[blockRow + Math.floor(x / block)]) continue
      const index = (y * width + x) * 4
      const lum = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]
      if (bgRow[x] > 120 && lum / bgRow[x] < 0.85) {
        xs.push(x)
        ys.push(y)
      }
    }
  }
  const step = Math.max(1, Math.ceil(xs.length / MAX_POINTS))
  const px = []
  const py = []
  for (let i = 0; i < xs.length; i += step) {
    px.push(xs[i])
    py.push(ys[i])
  }
  return { px, py }
}

function profileScore(px, py, width, height, degrees) {
  const slope = Math.tan((degrees * Math.PI) / 180)
  const offset = Math.ceil(Math.abs(slope) * width) + 2
  const bins = new Float32Array(height + offset * 2 + 4)
  for (let i = 0; i < px.length; i++) {
    bins[Math.floor(py[i] - px[i] * slope + offset)] += 1
  }
  let score = 0
  for (let i = 0; i < bins.length; i++) score += bins[i] * bins[i]
  return score
}

export function estimateSkewCorrection(imageData) {
  const { width, height } = imageData
  const { px, py } = collectInk(imageData)
  if (px.length < 200) return 0

  const flat = profileScore(px, py, width, height, 0)
  let best = 0
  let bestScore = flat
  for (let degrees = -SEARCH_LIMIT; degrees <= SEARCH_LIMIT; degrees += 0.5) {
    const score = profileScore(px, py, width, height, degrees)
    if (score > bestScore) {
      bestScore = score
      best = degrees
    }
  }
  const center = best
  for (let degrees = center - 0.5; degrees <= center + 0.5; degrees += 0.1) {
    const score = profileScore(px, py, width, height, degrees)
    if (score > bestScore) {
      bestScore = score
      best = degrees
    }
  }

  if (Math.abs(best) < 0.3 || bestScore / flat < 1.04) return 0
  return Math.round(-best * 10) / 10
}
