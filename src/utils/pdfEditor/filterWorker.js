import { applyFilter, isBlankImageData } from './filters.js'

self.onmessage = (event) => {
  const { id, task, buffer, width, height, filter } = event.data
  const data = new Uint8ClampedArray(buffer)
  if (task === 'blank') {
    self.postMessage({ id, blank: isBlankImageData({ data, width, height }) })
    return
  }
  applyFilter({ data, width, height }, filter)
  self.postMessage({ id, buffer: data.buffer }, [data.buffer])
}
