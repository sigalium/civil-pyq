import { useCallback, useEffect, useRef, useState } from 'react'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import { clamp, displayDims, isFullCrop } from '../../utils/pdfEditor/geometry'
import { renderDisplayCanvas } from '../../utils/pdfEditor/sources'
import { detectDocumentRect } from '../../utils/pdfEditor/autoCrop'
import { useZoomPan } from './useZoomPan'

const MIN_SIZE = 0.04
const MAX_RENDER_WIDTH = 2200
const AREA_INSET = 48
const FULL = { x: 0, y: 0, w: 1, h: 1 }
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function resizeRect(start, mode, dx, dy) {
  let left = start.x
  let top = start.y
  let right = start.x + start.w
  let bottom = start.y + start.h
  if (mode.includes('w')) left = clamp(start.x + dx, 0, right - MIN_SIZE)
  if (mode.includes('e')) right = clamp(right + dx, left + MIN_SIZE, 1)
  if (mode.includes('n')) top = clamp(start.y + dy, 0, bottom - MIN_SIZE)
  if (mode.includes('s')) bottom = clamp(bottom + dy, top + MIN_SIZE, 1)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

const PDFCropEditor = ({ page, source, index, total, selectedCount, selectedIncludesPage, onApply, onNavigate, onClose }) => {
  const areaRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const [area, setArea] = useState({ w: 0, h: 0 })
  const [rect, setRect] = useState(page.crop || FULL)
  const [detecting, setDetecting] = useState(false)
  const [note, setNote] = useState('')
  const [scope, setScope] = useState('page')

  const dims = displayDims(page)
  const aspect = dims.w / dims.h
  const fitWidth = Math.max(0, Math.min(area.w, area.h * aspect))
  const fitHeight = fitWidth / aspect
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const { kind, sourceIndex, baseRotation, baseW, baseH, rotation, filter, annotations, skew } = page
  const cancelDrag = useCallback(() => {
    dragRef.current = null
  }, [])
  const zoom = useZoomPan({
    areaRef,
    containerW: area.w + AREA_INSET,
    containerH: area.h + AREA_INSET,
    fitWidth,
    fitHeight,
    onGestureStart: cancelDrag,
    pad: AREA_INSET / 2,
  })
  const renderWidth = Math.min(MAX_RENDER_WIDTH, Math.round(fitWidth * dpr * Math.min(3, Math.ceil(zoom.scale))))

  useEffect(() => {
    const node = areaRef.current
    if (!node) return undefined
    const measure = () => setArea({ w: node.clientWidth - AREA_INSET, h: node.clientHeight - AREA_INSET })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || renderWidth < 20) return undefined
    let cancelled = false
    const descriptor = { kind, sourceIndex, baseRotation, baseW, baseH, rotation, filter, annotations, skew }
    renderDisplayCanvas(source, descriptor, { width: renderWidth })
      .then((rendered) => {
        if (cancelled) {
          rendered.width = 0
          return
        }
        canvas.width = rendered.width
        canvas.height = rendered.height
        canvas.getContext('2d').drawImage(rendered, 0, 0)
        rendered.width = 0
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [renderWidth, source, kind, sourceIndex, baseRotation, baseW, baseH, rotation, filter, annotations, skew])

  const pointerFraction = useCallback((event) => {
    const bounds = stageRef.current.getBoundingClientRect()
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    }
  }, [])

  const beginDrag = (event, mode) => {
    event.preventDefault()
    event.stopPropagation()
    stageRef.current.setPointerCapture(event.pointerId)
    const point = pointerFraction(event)
    dragRef.current = { mode, origin: point, start: rect }
  }

  const handleStagePointerDown = (event) => {
    beginDrag(event, 'draw')
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const point = pointerFraction(event)
    const dx = point.x - drag.origin.x
    const dy = point.y - drag.origin.y
    if (drag.mode === 'draw') {
      const left = Math.min(drag.origin.x, point.x)
      const top = Math.min(drag.origin.y, point.y)
      setRect({ x: left, y: top, w: Math.max(MIN_SIZE, Math.abs(dx)), h: Math.max(MIN_SIZE, Math.abs(dy)) })
    } else if (drag.mode === 'move') {
      setRect({
        x: clamp(drag.start.x + dx, 0, 1 - drag.start.w),
        y: clamp(drag.start.y + dy, 0, 1 - drag.start.h),
        w: drag.start.w,
        h: drag.start.h,
      })
    } else {
      setRect(resizeRect(drag.start, drag.mode, dx, dy))
    }
  }

  const handlePointerUp = (event) => {
    if (!dragRef.current) return
    dragRef.current = null
    if (stageRef.current.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId)
  }

  const finalRect = isFullCrop(rect) ? null : rect

  const autoDetect = async () => {
    setDetecting(true)
    setNote('')
    try {
      const descriptor = { kind, sourceIndex, baseRotation, baseW, baseH, rotation, filter: 'original', annotations: [], skew }
      const canvas = await renderDisplayCanvas(source, descriptor, { width: 320, filter: 'original', withAnnotations: false })
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
      canvas.width = 0
      const found = detectDocumentRect(imageData)
      if (found) setRect(found)
      else setNote('No document edges found.')
    } catch {
      setNote('Could not detect edges.')
    }
    setDetecting(false)
  }

  const scopes = [{ key: 'page', label: 'This page' }]
  if (selectedCount > 1 && selectedIncludesPage) scopes.push({ key: 'selected', label: `Selected (${selectedCount})` })
  if (total > 1) scopes.push({ key: 'all', label: `All pages (${total})` })
  const activeScope = scopes.some((item) => item.key === scope) ? scope : 'page'

  return (
    <div className="pe-editor">
      <div className="pe-editor-head">
        <div className="pe-editor-title">
          <strong>Crop</strong>
          <div className="pe-nav">
            <button type="button" className="pe-icon-btn" onClick={() => onNavigate(-1)} disabled={index === 0} aria-label="Previous page">
              <ChevronLeftIcon sx={{ fontSize: 20 }} />
            </button>
            <span>
              {index + 1} / {total}
            </span>
            <button type="button" className="pe-icon-btn" onClick={() => onNavigate(1)} disabled={index === total - 1} aria-label="Next page">
              <ChevronRightIcon sx={{ fontSize: 20 }} />
            </button>
          </div>
        </div>
        <div className="pe-editor-tools">
          <button type="button" className="pe-icon-btn" onClick={() => zoom.zoomBy(1 / 1.4)} aria-label="Zoom out" title="Zoom out">
            <ZoomOutIcon sx={{ fontSize: 18 }} />
          </button>
          <button type="button" className="pe-icon-btn" onClick={() => zoom.zoomBy(1.4)} aria-label="Zoom in" title="Zoom in">
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </button>
          <button type="button" className="pe-icon-btn" onClick={zoom.reset} aria-label="Fit page" title="Fit page">
            <FitScreenIcon sx={{ fontSize: 18 }} />
          </button>
          <span className="pe-header-sep" />
          <button type="button" className="pe-btn" onClick={autoDetect} disabled={detecting}>
            {detecting ? 'Detecting…' : 'Auto detect'}
          </button>
          <button type="button" className="pe-btn ghost" onClick={() => setRect(FULL)}>
            Reset
          </button>
        </div>
      </div>
      {note && <p className="pe-note pe-editor-note">{note}</p>}
      <div className={`pe-crop-area ${zoom.panning ? 'panning' : ''}`} ref={areaRef} {...zoom.bind}>
        {fitWidth > 0 && (
          <div className="pe-zoom-layer" style={zoom.layerStyle}>
          <div
            className="pe-crop-stage"
            ref={stageRef}
            style={{ width: '100%', height: '100%' }}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas ref={canvasRef} className="pe-crop-canvas" style={{ width: '100%', height: '100%' }} />
            <div
              className={`pe-crop-rect ${isFullCrop(rect) ? 'full' : ''}`}
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
              }}
              onPointerDown={(event) => beginDrag(event, 'move')}
            >
              {HANDLES.map((handle) => (
                <span key={handle} className={`pe-crop-handle ${handle}`} onPointerDown={(event) => beginDrag(event, handle)} />
              ))}
            </div>
          </div>
          </div>
        )}
      </div>
      <div className="pe-editor-foot">
        <div className="pe-foot-scope">
          <span className="pe-foot-label">Apply to</span>
          <div className="pe-segment">
            {scopes.map((item) => (
              <button key={item.key} type="button" className={`pe-segment-btn ${activeScope === item.key ? 'active' : ''}`} onClick={() => setScope(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pe-foot-actions">
          <button type="button" className="pe-btn ghost" onClick={onClose}>
            Cancel
          </button>
          {activeScope === 'page' && (
            <button type="button" className="pe-btn" onClick={() => onApply('page', finalRect, true)} disabled={index === total - 1}>
              Apply and next
            </button>
          )}
          <button type="button" className="pe-btn primary" onClick={() => onApply(activeScope, finalRect, false)}>
            Apply crop
          </button>
        </div>
      </div>
    </div>
  )
}

export default PDFCropEditor
