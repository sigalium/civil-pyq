export const FILTERS = [
  { key: 'original', label: 'Original' },
  { key: 'auto', label: 'Auto colour' },
  { key: 'lighttext', label: 'Light text' },
  { key: 'grayscale', label: 'Grayscale' },
  { key: 'whiteboard', label: 'Whiteboard' },
]

const smoothstep = (low, high, value) => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

const clampByte = (value) => (value < 0 ? 0 : value > 255 ? 255 : value)

export function estimateBackground(data, width, height) {
  const block = Math.max(6, Math.round(Math.max(width, height) / 40))
  const cols = Math.ceil(width / block)
  const rows = Math.ceil(height / block)
  const stride = Math.max(1, Math.ceil(block / 12))
  const grid = new Float32Array(cols * rows)
  const samples = []

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      samples.length = 0
      const yEnd = Math.min(height, (by + 1) * block)
      const xEnd = Math.min(width, (bx + 1) * block)
      for (let y = by * block; y < yEnd; y += stride) {
        for (let x = bx * block; x < xEnd; x += stride) {
          const index = (y * width + x) * 4
          samples.push(0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2])
        }
      }
      samples.sort((a, b) => b - a)
      const take = Math.max(1, Math.ceil(samples.length * 0.25))
      let sum = 0
      for (let i = 0; i < take; i++) sum += samples[i]
      grid[by * cols + bx] = sum / take
    }
  }

  const smoothed = new Float32Array(grid.length)
  for (let pass = 0; pass < 2; pass++) {
    const source = pass === 0 ? grid : smoothed.slice()
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let total = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
            total += source[ny * cols + nx]
            count += 1
          }
        }
        smoothed[y * cols + x] = total / count
      }
    }
  }

  return { grid: smoothed, cols, rows, block }
}

export function buildSampler(background, width) {
  const { grid, cols, rows, block } = background
  const x0 = new Int32Array(width)
  const x1 = new Int32Array(width)
  const fx = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    const g = (x + 0.5) / block - 0.5
    const base = Math.floor(g)
    x0[x] = Math.min(cols - 1, Math.max(0, base))
    x1[x] = Math.min(cols - 1, Math.max(0, base + 1))
    fx[x] = Math.min(1, Math.max(0, g - base))
  }
  return (y) => {
    const g = (y + 0.5) / block - 0.5
    const base = Math.floor(g)
    const y0 = Math.min(rows - 1, Math.max(0, base))
    const y1 = Math.min(rows - 1, Math.max(0, base + 1))
    const fy = Math.min(1, Math.max(0, g - base))
    const row = new Float32Array(width)
    for (let x = 0; x < width; x++) {
      const top = grid[y0 * cols + x0[x]] * (1 - fx[x]) + grid[y0 * cols + x1[x]] * fx[x]
      const bottom = grid[y1 * cols + x0[x]] * (1 - fx[x]) + grid[y1 * cols + x1[x]] * fx[x]
      row[x] = top * (1 - fy) + bottom * fy
    }
    return row
  }
}

export function applyFilter(imageData, filter) {
  if (filter === 'original') return imageData
  const { data, width, height } = imageData
  const background = estimateBackground(data, width, height)
  const rowAt = buildSampler(background, width)

  for (let y = 0; y < height; y++) {
    const bgRow = rowAt(y)
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      const gain = Math.min(4, 255 / Math.max(60, bgRow[x]))
      let r = clampByte(data[index] * gain)
      let g = clampByte(data[index + 1] * gain)
      let b = clampByte(data[index + 2] * gain)
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255

      if (filter === 'auto') {
        const level = Math.min(1, Math.max(0, (lum - 0.05) / 0.95))
        const curved = 0.6 * level + 0.4 * smoothstep(0, 1, level)
        const factor = lum > 0.001 ? curved / lum : 1
        const mean = (r + g + b) / 3
        r = clampByte((mean + (r - mean) * 1.12) * factor)
        g = clampByte((mean + (g - mean) * 1.12) * factor)
        b = clampByte((mean + (b - mean) * 1.12) * factor)
      } else if (filter === 'grayscale') {
        const level = Math.min(1, Math.max(0, (lum - 0.06) / 0.94))
        const value = clampByte(255 * (0.5 * level + 0.5 * smoothstep(0, 1, level)))
        r = value
        g = value
        b = value
      } else if (filter === 'lighttext') {
        const value = clampByte(255 * smoothstep(0.72, 0.93, lum))
        r = value
        g = value
        b = value
      } else if (filter === 'whiteboard') {
        const white = smoothstep(0.8, 0.94, lum)
        const mean = (r + g + b) / 3
        const ink = 1 - white
        r = clampByte((mean + (r - mean) * (1 + 0.5 * ink)) * (1 - 0.15 * ink))
        g = clampByte((mean + (g - mean) * (1 + 0.5 * ink)) * (1 - 0.15 * ink))
        b = clampByte((mean + (b - mean) * (1 + 0.5 * ink)) * (1 - 0.15 * ink))
        r = r * (1 - white) + 255 * white
        g = g * (1 - white) + 255 * white
        b = b * (1 - white) + 255 * white
      }

      data[index] = r
      data[index + 1] = g
      data[index + 2] = b
    }
  }
  return imageData
}

export function isBlankImageData(imageData) {
  const { data, width, height } = imageData
  const background = estimateBackground(data, width, height)
  const rowAt = buildSampler(background, width)
  const marginX = Math.round(width * 0.05)
  const marginY = Math.round(height * 0.05)
  let inspected = 0
  let ink = 0
  let brightSum = 0

  for (let y = marginY; y < height - marginY; y++) {
    const bgRow = rowAt(y)
    for (let x = marginX; x < width - marginX; x++) {
      const index = (y * width + x) * 4
      const lum = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]
      inspected += 1
      brightSum += bgRow[x]
      if (lum / Math.max(60, bgRow[x]) < 0.78) ink += 1
    }
  }

  if (!inspected) return false
  if (brightSum / inspected < 90) return false
  return ink / inspected < 0.002
}
