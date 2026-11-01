import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 0.5
const MAX_SCALE = 6

export function useZoomPan({ areaRef, containerW, containerH, fitWidth, fitHeight, onGestureStart, pad = 0 }) {
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
  const [panning, setPanning] = useState(false)
  const viewRef = useRef(view)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const panRef = useRef(null)
  const startRef = useRef(onGestureStart)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    startRef.current = onGestureStart
  }, [onGestureStart])

  const baseX = (containerW - fitWidth) / 2
  const baseY = (containerH - fitHeight) / 2

  const clampView = useCallback(
    (scale, tx, ty) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
      const scaledW = fitWidth * nextScale
      const scaledH = fitHeight * nextScale
      const limit = (scaled, container, base, value) => {
        if (scaled <= container - pad * 2) return (container - scaled) / 2 - base
        return Math.min(-base + pad, Math.max(container - scaled - base - pad, value))
      }
      return { scale: nextScale, tx: limit(scaledW, containerW, baseX, tx), ty: limit(scaledH, containerH, baseY, ty) }
    },
    [containerW, containerH, fitWidth, fitHeight, baseX, baseY, pad]
  )

  const commitView = useCallback((next) => {
    viewRef.current = next
    setView(next)
  }, [])

  const zoomAbout = useCallback(
    (focal, nextScale, from) => {
      const start = from || viewRef.current
      const localX = (focal.x - baseX - start.tx) / start.scale
      const localY = (focal.y - baseY - start.ty) / start.scale
      commitView(clampView(nextScale, focal.x - baseX - nextScale * localX, focal.y - baseY - nextScale * localY))
    },
    [baseX, baseY, clampView, commitView]
  )

  const zoomBy = useCallback(
    (factor) => {
      zoomAbout({ x: containerW / 2, y: containerH / 2 }, viewRef.current.scale * factor)
    },
    [containerW, containerH, zoomAbout]
  )

  const reset = useCallback(() => commitView({ scale: 1, tx: 0, ty: 0 }), [commitView])

  useEffect(() => {
    setView((previous) => clampView(previous.scale, previous.tx, previous.ty))
  }, [clampView])

  useEffect(() => {
    const node = areaRef.current
    if (!node) return undefined
    const handleWheel = (event) => {
      const bounds = node.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const current = viewRef.current
      const left = baseX + current.tx
      const top = baseY + current.ty
      const inside = x >= left && x <= left + fitWidth * current.scale && y >= top && y <= top + fitHeight * current.scale
      if (!inside) return
      event.preventDefault()
      const sensitivity = event.ctrlKey || event.metaKey ? 0.01 : 0.0015
      zoomAbout({ x, y }, current.scale * Math.exp(-event.deltaY * sensitivity))
    }
    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  }, [areaRef, zoomAbout, baseX, baseY, fitWidth, fitHeight])

  const measurePair = () => {
    const [a, b] = Array.from(pointers.current.values())
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }

  const onPointerDownCapture = (event) => {
    if (event.pointerType === 'mouse' && event.button === 1) {
      event.preventDefault()
      event.stopPropagation()
      panRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: viewRef.current }
      areaRef.current.setPointerCapture(event.pointerId)
      setPanning(true)
      return
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      if (startRef.current) startRef.current()
      const pair = measurePair()
      const bounds = areaRef.current.getBoundingClientRect()
      gesture.current = {
        distance: pair.distance || 1,
        mid: { x: pair.mid.x - bounds.left, y: pair.mid.y - bounds.top },
        view: viewRef.current,
      }
      event.stopPropagation()
      event.preventDefault()
    } else if (gesture.current) {
      event.stopPropagation()
    }
  }

  const onPointerMoveCapture = (event) => {
    const pan = panRef.current
    if (pan && pan.id === event.pointerId) {
      event.stopPropagation()
      commitView(clampView(pan.view.scale, pan.view.tx + event.clientX - pan.x, pan.view.ty + event.clientY - pan.y))
      return
    }
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const active = gesture.current
    if (!active) return
    event.stopPropagation()
    if (pointers.current.size < 2) return
    const pair = measurePair()
    const bounds = areaRef.current.getBoundingClientRect()
    const mid = { x: pair.mid.x - bounds.left, y: pair.mid.y - bounds.top }
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, active.view.scale * (pair.distance / active.distance)))
    const localX = (active.mid.x - baseX - active.view.tx) / active.view.scale
    const localY = (active.mid.y - baseY - active.view.ty) / active.view.scale
    commitView(clampView(nextScale, mid.x - baseX - nextScale * localX, mid.y - baseY - nextScale * localY))
  }

  const onPointerUpCapture = (event) => {
    const pan = panRef.current
    if (pan && pan.id === event.pointerId) {
      event.stopPropagation()
      panRef.current = null
      setPanning(false)
      if (areaRef.current && areaRef.current.hasPointerCapture(event.pointerId)) areaRef.current.releasePointerCapture(event.pointerId)
      return
    }
    const hadGesture = !!gesture.current
    pointers.current.delete(event.pointerId)
    if (hadGesture) {
      event.stopPropagation()
      if (pointers.current.size < 2) gesture.current = null
    }
  }

  const preventMiddleDefault = (event) => {
    if (event.button === 1) event.preventDefault()
  }

  return {
    scale: view.scale,
    panning,
    layerStyle: {
      position: 'absolute',
      left: baseX,
      top: baseY,
      width: fitWidth,
      height: fitHeight,
      transformOrigin: '0 0',
      transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
    },
    zoomBy,
    reset,
    bind: {
      onPointerDownCapture,
      onPointerMoveCapture,
      onPointerUpCapture,
      onPointerCancelCapture: onPointerUpCapture,
      onMouseDown: preventMiddleDefault,
      onAuxClick: preventMiddleDefault,
    },
  }
}
