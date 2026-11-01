import { applyFilter, isBlankImageData } from './filters.js'

let worker = null
let workerBroken = false
let counter = 0
const pending = new Map()

function getWorker() {
  if (workerBroken || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./filterWorker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (event) => {
      const { id } = event.data
      const resolve = pending.get(id)
      if (resolve) {
        pending.delete(id)
        resolve(event.data)
      }
    }
    worker.onerror = () => {
      workerBroken = true
      pending.forEach((resolve) => resolve(null))
      pending.clear()
      worker = null
    }
  } catch {
    workerBroken = true
    worker = null
  }
  return worker
}

function request(message, transfer) {
  const active = getWorker()
  if (!active) return Promise.resolve(null)
  counter += 1
  const id = counter
  return new Promise((resolve) => {
    pending.set(id, resolve)
    active.postMessage({ ...message, id }, transfer)
  })
}

export async function filterCanvas(canvas, filter) {
  if (filter === 'original') return
  const context = canvas.getContext('2d')
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const reply = await request(
    { task: 'filter', buffer: imageData.data.buffer, width: canvas.width, height: canvas.height, filter },
    [imageData.data.buffer]
  )
  if (reply && reply.buffer) {
    context.putImageData(new ImageData(new Uint8ClampedArray(reply.buffer), canvas.width, canvas.height), 0, 0)
    return
  }
  const fresh = context.getImageData(0, 0, canvas.width, canvas.height)
  applyFilter(fresh, filter)
  context.putImageData(fresh, 0, 0)
}

export async function canvasIsBlank(canvas) {
  const context = canvas.getContext('2d')
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const reply = await request(
    { task: 'blank', buffer: imageData.data.buffer, width: canvas.width, height: canvas.height },
    [imageData.data.buffer]
  )
  if (reply && typeof reply.blank === 'boolean') return reply.blank
  return isBlankImageData(context.getImageData(0, 0, canvas.width, canvas.height))
}
