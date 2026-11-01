import { PDFDocument, StandardFonts, degrees } from 'pdf-lib'
import { cropToPdfBox, displayDims, totalRotation } from './geometry.js'
import { pageNeedsRaster } from './model.js'
import { drawVectorAnnotations } from './annotationsPdf.js'
import { DEFAULT_STAMPS, computeStamps, drawStampsOnCanvas, stampsActive } from './stamps.js'
import { drawVectorStamps } from './stampsPdf.js'

export const PAGE_RASTER_PRESET = { dpi: 150, jpegQuality: 0.82 }
export const DESKTOP_MAX_PIXELS = 24000000
export const MOBILE_MAX_PIXELS = 12000000

function applyBoxes(page, box, crop, rotationDeg) {
  page.setRotation(degrees(rotationDeg))
  if (!crop) return
  const rect = cropToPdfBox(box, crop, rotationDeg)
  page.setCropBox(rect.x, rect.y, rect.width, rect.height)
  page.setMediaBox(rect.x, rect.y, rect.width, rect.height)
}

async function addRasterPage(out, page, sources, preset, extra) {
  const { renderDisplayCanvas, cropCanvas, canvasToJpegBytes } = await import('./sources.js')
  const dims = displayDims(page)
  const source = page.sourceId ? sources.get(page.sourceId) : null
  let width = Math.max(1, Math.round((dims.w * preset.dpi) / 72))
  const pixels = width * (width * dims.h) / dims.w
  if (pixels > extra.maxPixels) width = Math.max(1, Math.floor(Math.sqrt((extra.maxPixels * dims.w) / dims.h)))
  const full = await renderDisplayCanvas(source, page, { width })
  const finalCanvas = page.crop ? cropCanvas(full, page.crop) : full
  if (finalCanvas !== full) full.width = 0
  const visibleW = dims.w * (page.crop ? page.crop.w : 1)
  const visibleH = dims.h * (page.crop ? page.crop.h : 1)
  if (stampsActive(extra.stamps)) {
    const context = finalCanvas.getContext('2d')
    const scale = finalCanvas.width / visibleW
    const list = computeStamps({
      width: visibleW,
      height: visibleH,
      index: extra.index,
      total: extra.total,
      stamps: extra.stamps,
      measure: (text, size) => {
        context.font = `${size * scale}px Helvetica, Arial, sans-serif`
        return context.measureText(text).width / scale
      },
    })
    drawStampsOnCanvas(context, list, scale)
  }
  const jpeg = await canvasToJpegBytes(finalCanvas, preset.jpegQuality)
  finalCanvas.width = 0
  const image = await out.embedJpg(jpeg)
  out.addPage([visibleW, visibleH]).drawImage(image, { x: 0, y: 0, width: visibleW, height: visibleH })
}

async function buildDocument(pages, sources, preset, onProgress, stamps, maxPixels) {
  const out = await PDFDocument.create()
  const slots = new Array(pages.length)
  const bySource = new Map()
  const rasterAll = !!preset

  pages.forEach((page, index) => {
    if (rasterAll || page.kind !== 'pdf' || pageNeedsRaster(page)) return
    if (!bySource.has(page.sourceId)) bySource.set(page.sourceId, [])
    bySource.get(page.sourceId).push({ index, page })
  })

  for (const [sourceId, entries] of bySource) {
    const source = sources.get(sourceId)
    const document = await PDFDocument.load(source.bytes, { ignoreEncryption: true, updateMetadata: false })
    const copied = await out.copyPages(document, entries.map((entry) => entry.page.sourceIndex))
    entries.forEach((entry, position) => {
      slots[entry.index] = copied[position]
    })
  }

  const stampsOn = stampsActive(stamps)
  const needsFont =
    !rasterAll &&
    pages.some((page) => !pageNeedsRaster(page) && (stampsOn || page.annotations.some((item) => item.type === 'text')))
  const font = needsFont ? await out.embedFont(StandardFonts.Helvetica) : null
  const embeddedImages = new Map()

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const extra = { index: i, total: pages.length, stamps, maxPixels }
    if (rasterAll) {
      await addRasterPage(out, page, sources, preset, extra)
    } else if (pageNeedsRaster(page)) {
      await addRasterPage(out, page, sources, PAGE_RASTER_PRESET, extra)
    } else {
      const rotation = totalRotation(page)
      let target
      let box
      if (page.kind === 'pdf') {
        target = slots[i]
        box = target.getCropBox()
      } else {
        target = out.addPage([page.baseW, page.baseH])
        box = { x: 0, y: 0, width: page.baseW, height: page.baseH }
        if (page.kind === 'image') {
          const source = sources.get(page.sourceId)
          if (!embeddedImages.has(source.id)) embeddedImages.set(source.id, await out.embedJpg(source.jpeg))
          target.drawImage(embeddedImages.get(source.id), { x: 0, y: 0, width: page.baseW, height: page.baseH })
        }
      }
      if (page.annotations.length) {
        drawVectorAnnotations(target, page.annotations, { box, baseRotation: page.kind === 'pdf' ? page.baseRotation : 0, baseW: page.baseW, font })
      }
      if (stampsOn) {
        const dims = displayDims(page)
        const visibleW = dims.w * (page.crop ? page.crop.w : 1)
        const visibleH = dims.h * (page.crop ? page.crop.h : 1)
        const list = computeStamps({
          width: visibleW,
          height: visibleH,
          index: i,
          total: pages.length,
          stamps,
          measure: (text, size) => font.widthOfTextAtSize(text, size),
        })
        drawVectorStamps(target, list, { box, crop: page.crop, visibleW, visibleH, rotationDeg: rotation, font })
      }
      applyBoxes(target, box, page.crop, rotation)
      if (page.kind === 'pdf') out.addPage(target)
    }
    if (onProgress) onProgress(i + 1, pages.length)
  }

  return out
}

export async function exportDocument({ pages, sources, preset, name, onProgress, stamps = DEFAULT_STAMPS, maxPixels = DESKTOP_MAX_PIXELS }) {
  const out = await buildDocument(pages, sources, preset, onProgress, stamps, maxPixels)
  const bytes = await out.save()
  const baseName = (name || 'document').replace(/\.pdf$/i, '')
  return new File([bytes], `${baseName}.pdf`, { type: 'application/pdf' })
}
