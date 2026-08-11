import { useLayoutEffect, useRef } from 'react'

export function useFlip(containerRef, deps = []) {
  const prevRects = useRef(new Map())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const children = container.querySelectorAll('[data-drag-id]')
    const newRects = new Map()

    children.forEach((child) => {
      const id = child.getAttribute('data-drag-id')
      newRects.set(id, child.getBoundingClientRect())
    })

    children.forEach((child) => {
      const id = child.getAttribute('data-drag-id')
      const prev = prevRects.current.get(id)
      const next = newRects.get(id)
      if (prev && next) {
        const dx = prev.left - next.left
        const dy = prev.top - next.top
        if (dx || dy) {
          child.style.transition = 'none'
          child.style.transform = `translate(${dx}px, ${dy}px)`
          requestAnimationFrame(() => {
            child.style.transition = 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)'
            child.style.transform = ''
          })
        }
      }
    })

    prevRects.current = newRects
  }, deps)
}
