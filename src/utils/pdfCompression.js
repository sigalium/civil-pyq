import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url'
import { PDFDocument } from 'pdf-lib'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export const COMPRESSION_PRESETS = {
  low: { label: 'Low compression', dpi: 130, jpegQuality: 0.78 },
  medium: { label: 'Medium compression', dpi: 100, jpegQuality: 0.62 },
  high: { label: 'High compression', dpi: 80, jpegQuality: 0.45 },
}

async function fileToArrayBuffer(file) {
  if (file.arrayBuffer) return file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export async function loadPdfDocument(file) {
  const buffer = await fileToArrayBuffer(file)
  return pdfjsLib.getDocument({ data: buffer }).promise
}

async function renderPageToCanvas(pdfDoc, pageNumber, dpi) {
  const page = await pdfDoc.getPage(pageNumber)
  const scale = dpi / 72
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise
  const basePoints = page.getViewport({ scale: 1 })
  return { canvas, pageWidthPt: basePoints.width, pageHeightPt: basePoints.height }
}

function canvasToJpegBytes(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode page as JPEG.'))
          return
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)))
      },
      'image/jpeg',
      quality
    )
  })
}

export async function renderPageDataUrl(pdfDoc, pageNumber, presetKey) {
  const preset = COMPRESSION_PRESETS[presetKey]
  const { canvas } = await renderPageToCanvas(pdfDoc, pageNumber, preset.dpi)
  return canvas.toDataURL('image/jpeg', preset.jpegQuality)
}

export async function compressLoadedPdf(pdfDoc, presetKey, onProgress) {
  const preset = COMPRESSION_PRESETS[presetKey]
  if (!preset) throw new Error('Unknown compression preset.')

  const outDoc = await PDFDocument.create()

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const { canvas, pageWidthPt, pageHeightPt } = await renderPageToCanvas(pdfDoc, i, preset.dpi)
    const jpegBytes = await canvasToJpegBytes(canvas, preset.jpegQuality)
    const jpegImage = await outDoc.embedJpg(jpegBytes)
    const outPage = outDoc.addPage([pageWidthPt, pageHeightPt])
    outPage.drawImage(jpegImage, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt })
    if (onProgress) onProgress(i, pdfDoc.numPages)
  }

  return outDoc.save()
}

export async function compressPdf(file, presetKey, onProgress) {
  const pdfDoc = await loadPdfDocument(file)
  const outBytes = await compressLoadedPdf(pdfDoc, presetKey, onProgress)
  const baseName = file.name ? file.name.replace(/\.pdf$/i, '') : 'document'
  return new File([outBytes], `${baseName}-compressed.pdf`, { type: 'application/pdf' })
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(2)} MB`
}
