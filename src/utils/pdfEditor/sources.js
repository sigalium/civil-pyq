import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url'
import { A4_WIDTH, A4_HEIGHT, clamp, displayDims } from './geometry.js'
import { drawAnnotations } from './annotations.js'
import { filterCanvas } from './filterClient.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const MAX_IMAGE_SIDE = 3000
const MAX_CONCURRENT_RENDERS = 2

let sourceCounter = 0
let activeRenders = 0
const waitingRenders = []

const nextSourceId = () => {
  sourceCounter += 1
  return `src${sourceCounter}`
}

function pumpRenders() {
  while (activeRenders < MAX_CONCURRENT_RENDERS && waitingRenders.length) {
    const job = waitingRenders.shift()
    activeRenders += 1
    const task = job.token && job.token.cancelled ? Promise.resolve(null) : job.run()
    task
      .then(job.resolve, job.reject)
      .finally(() => {
        activeRenders -= 1
        pumpRenders()
      })
  }
}

export function enqueueRender(run, token) {
  return new Promise((resolve, reject) => {
    waitingRenders.push({ run, token, resolve, reject })
    pumpRenders()
  })
}

export async function createPdfSource(file) {
  const bytes = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise
  const pageInfo = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    pageInfo.push({ width: viewport.width, height: viewport.height, rotate: page.rotate || 0 })
    page.cleanup()
  }
  return { id: nextSourceId(), kind: 'pdf', name: file.name, bytes, doc, pageInfo }
}

export async function createImageSource(file) {
  const bitmap = await createImageBitmap(file)
  const shrink = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * shrink))
  canvas.height = Math.max(1, Math.round(bitmap.height * shrink))
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const jpeg = await canvasToJpegBytes(canvas, 0.9)
  const fit = Math.min(A4_WIDTH / canvas.width, A4_HEIGHT / canvas.height)
  return {
    id: nextSourceId(),
    kind: 'image',
    name: file.name,
    canvas,
    jpeg,
    width: canvas.width * fit,
    height: canvas.height * fit,
  }
}

export function destroySource(source) {
  if (source.kind === 'pdf' && source.doc) source.doc.destroy()
  if (source.kind === 'image' && source.canvas) source.canvas.width = 0
}

export function canvasToJpegBytes(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode page as JPEG.'))
          return
        }
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject)
      },
      'image/jpeg',
      quality
    )
  })
}

export async function renderPageCanvas(source, page, { width, rotation }) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const turns = (rotation / 90) % 2 === 1

  if (page.kind === 'pdf') {
    const pdfPage = await source.doc.getPage(page.sourceIndex + 1)
    const unit = pdfPage.getViewport({ scale: 1, rotation })
    const viewport = pdfPage.getViewport({ scale: width / unit.width, rotation })
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await pdfPage.render({ canvasContext: context, viewport, background: '#ffffff' }).promise
    pdfPage.cleanup()
    return canvas
  }

  const baseRatio = page.baseH / page.baseW
  const ratio = turns ? 1 / baseRatio : baseRatio
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(width * ratio))
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  if (page.kind === 'image' && source) {
    const drawWidth = turns ? canvas.height : canvas.width
    const drawHeight = turns ? canvas.width : canvas.height
    context.save()
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((rotation * Math.PI) / 180)
    context.drawImage(source.canvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
    context.restore()
  }
  return canvas
}

export function cropCanvas(canvas, crop) {
  const x = Math.round(clamp(crop.x, 0, 1) * canvas.width)
  const y = Math.round(clamp(crop.y, 0, 1) * canvas.height)
  const width = Math.max(1, Math.min(canvas.width - x, Math.round(crop.w * canvas.width)))
  const height = Math.max(1, Math.min(canvas.height - y, Math.round(crop.h * canvas.height)))
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  output.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, width, height)
  return output
}

function applySkew(canvas, degrees) {
  const output = document.createElement('canvas')
  output.width = canvas.width
  output.height = canvas.height
  const context = output.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, output.width, output.height)
  context.translate(output.width / 2, output.height / 2)
  context.rotate((degrees * Math.PI) / 180)
  context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  canvas.width = 0
  return output
}

export async function renderBaseCanvas(source, page, { width, filter, annotations }) {
  let base = await renderPageCanvas(source, page, { width, rotation: page.kind === 'pdf' ? page.baseRotation : 0 })
  if (page.skew) base = applySkew(base, page.skew)
  if (filter && filter !== 'original') await filterCanvas(base, filter)
  if (annotations && annotations.length) drawAnnotations(base.getContext('2d'), annotations, base.width, base.height, 0)
  return base
}

function rotateCanvas(canvas, quarterTurns) {
  const sideways = quarterTurns % 2 === 1
  const output = document.createElement('canvas')
  output.width = sideways ? canvas.height : canvas.width
  output.height = sideways ? canvas.width : canvas.height
  const context = output.getContext('2d')
  context.translate(output.width / 2, output.height / 2)
  context.rotate((quarterTurns * Math.PI) / 2)
  context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return output
}

export async function renderDisplayCanvas(source, page, { width, filter, withAnnotations = true }) {
  const dims = displayDims(page)
  const scale = width / dims.w
  const base = await renderBaseCanvas(source, page, {
    width: Math.max(1, Math.round(page.baseW * scale)),
    filter: filter === undefined ? page.filter : filter,
    annotations: null,
  })
  const turns = (page.rotation / 90) % 4
  let output = base
  if (turns !== 0) {
    output = rotateCanvas(base, turns)
    base.width = 0
  }
  if (withAnnotations && page.annotations.length) {
    drawAnnotations(output.getContext('2d'), page.annotations, output.width, output.height, turns)
  }
  return output
}
