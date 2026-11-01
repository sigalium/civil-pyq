import { normalizeDeg, rotateRect, A4_WIDTH, A4_HEIGHT } from './geometry.js'
import { hasLatinOnlyText } from './annotations.js'

export const HISTORY_LIMIT = 100

let idCounter = 0

export const newPageId = () => {
  idCounter += 1
  return `pg${idCounter}`
}

export function pagesFromSource(source) {
  if (source.kind === 'pdf') {
    return source.pageInfo.map((info, index) => ({
      id: newPageId(),
      sourceId: source.id,
      sourceIndex: index,
      kind: 'pdf',
      baseW: info.width,
      baseH: info.height,
      baseRotation: info.rotate,
      rotation: 0,
      crop: null,
      filter: 'original',
      annotations: [],
      skew: 0,
    }))
  }
  return [
    {
      id: newPageId(),
      sourceId: source.id,
      sourceIndex: 0,
      kind: 'image',
      baseW: source.width,
      baseH: source.height,
      baseRotation: 0,
      rotation: 0,
      crop: null,
      filter: 'original',
      annotations: [],
      skew: 0,
    },
  ]
}

export function createBlankPage(reference) {
  return {
    id: newPageId(),
    sourceId: null,
    sourceIndex: 0,
    kind: 'blank',
    baseW: reference ? reference.baseW : A4_WIDTH,
    baseH: reference ? reference.baseH : A4_HEIGHT,
    baseRotation: 0,
    rotation: 0,
    crop: null,
    filter: 'original',
    annotations: [],
    skew: 0,
  }
}

export function pageNeedsRaster(page) {
  return page.filter !== 'original' || page.skew !== 0 || !hasLatinOnlyText(page.annotations)
}

export function rotatePages(pages, ids, delta) {
  const target = new Set(ids)
  return pages.map((page) => {
    if (!target.has(page.id)) return page
    return {
      ...page,
      rotation: normalizeDeg(page.rotation + delta),
      crop: page.crop ? rotateRect(page.crop, delta / 90) : null,
    }
  })
}

export function deletePages(pages, ids) {
  const target = new Set(ids)
  return pages.filter((page) => !target.has(page.id))
}

export function keepPages(pages, ids) {
  const target = new Set(ids)
  return pages.filter((page) => target.has(page.id))
}

export function duplicatePages(pages, ids) {
  const target = new Set(ids)
  const result = []
  pages.forEach((page) => {
    result.push(page)
    if (target.has(page.id)) result.push({ ...page, id: newPageId() })
  })
  return result
}

export function movePagesTo(pages, ids, targetIndex) {
  const target = new Set(ids)
  const moving = pages.filter((page) => target.has(page.id))
  const rest = pages.filter((page) => !target.has(page.id))
  const insertAt = pages.slice(0, targetIndex).filter((page) => !target.has(page.id)).length
  return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)]
}

export function movePagesBy(pages, ids, direction) {
  const target = new Set(ids)
  const next = pages.slice()
  if (direction < 0) {
    for (let i = 1; i < next.length; i++) {
      if (target.has(next[i].id) && !target.has(next[i - 1].id)) {
        const swap = next[i - 1]
        next[i - 1] = next[i]
        next[i] = swap
      }
    }
  } else {
    for (let i = next.length - 2; i >= 0; i--) {
      if (target.has(next[i].id) && !target.has(next[i + 1].id)) {
        const swap = next[i + 1]
        next[i + 1] = next[i]
        next[i] = swap
      }
    }
  }
  return next
}

export function insertPagesAt(pages, incoming, index) {
  return [...pages.slice(0, index), ...incoming, ...pages.slice(index)]
}

export function setCropFor(pages, ids, crop) {
  const target = new Set(ids)
  return pages.map((page) => (target.has(page.id) ? { ...page, crop } : page))
}

export function setFilterFor(pages, ids, filter) {
  const target = new Set(ids)
  return pages.map((page) => (target.has(page.id) ? { ...page, filter } : page))
}

export function setSkewFor(pages, corrections) {
  return pages.map((page) => (corrections.has(page.id) ? { ...page, skew: corrections.get(page.id) } : page))
}

export function setAnnotationsFor(pages, id, annotations) {
  return pages.map((page) => (page.id === id ? { ...page, annotations } : page))
}

export const createHistory = (present) => ({ past: [], present, future: [] })

export const commitHistory = (history, present) => ({
  past: [...history.past, history.present].slice(-HISTORY_LIMIT),
  present,
  future: [],
})

export function undoHistory(history) {
  if (!history.past.length) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  }
}

export function redoHistory(history) {
  if (!history.future.length) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  }
}
