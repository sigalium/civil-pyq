import { renderPageCanvas } from './sources'
import { estimateSkewCorrection } from './deskew'

export async function straightenPages(pages, ids, sources, onProgress) {
  const target = new Set(ids)
  const wanted = pages.filter((page) => target.has(page.id))
  const corrections = new Map()
  for (let i = 0; i < wanted.length; i++) {
    const page = wanted[i]
    if (page.kind === 'blank') {
      corrections.set(page.id, 0)
    } else {
      const source = page.sourceId ? sources.get(page.sourceId) : null
      const canvas = await renderPageCanvas(source, page, { width: 640, rotation: page.kind === 'pdf' ? page.baseRotation : 0 })
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
      canvas.width = 0
      corrections.set(page.id, estimateSkewCorrection(imageData))
    }
    if (onProgress) onProgress(i + 1, wanted.length)
  }
  return corrections
}
