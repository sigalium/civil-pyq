import { renderPageCanvas } from './sources'
import { canvasIsBlank } from './filterClient'

export async function findBlankPages(pages, sources, onProgress) {
  const blank = []
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (page.kind === 'blank' && !page.annotations.length) {
      blank.push(page.id)
    } else if (!page.annotations.length) {
      const source = page.sourceId ? sources.get(page.sourceId) : null
      const canvas = await renderPageCanvas(source, page, { width: 320, rotation: page.kind === 'pdf' ? page.baseRotation : 0 })
      const isBlank = await canvasIsBlank(canvas)
      canvas.width = 0
      if (isBlank) blank.push(page.id)
    }
    if (onProgress) onProgress(i + 1, pages.length)
  }
  return blank
}
