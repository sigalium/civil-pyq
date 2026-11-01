import { useCallback, useEffect, useRef, useState } from 'react'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import EditIcon from '@mui/icons-material/Edit'
import HighlightIcon from '@mui/icons-material/Highlight'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import NorthEastIcon from '@mui/icons-material/NorthEast'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import BackspaceIcon from '@mui/icons-material/Backspace'
import PaletteIcon from '@mui/icons-material/Palette'
import PDFStampOverlay from './PDFStampOverlay'
import { displayDims } from '../../utils/pdfEditor/geometry'
import { renderDisplayCanvas } from '../../utils/pdfEditor/sources'
import { useZoomPan } from './useZoomPan'
import {
  ANNOTATION_COLORS,
  ANNOTATION_SIZES,
  FONT_STACK,
  TEXT_MULTIPLIER,
  annotationHit,
  drawAnnotations,
  newAnnotationId,
  rotatePoint,
} from '../../utils/pdfEditor/annotations'

const TOOLS = [
  { key: 'pen', label: 'Pen', icon: EditIcon },
  { key: 'highlight', label: 'Highlight', icon: HighlightIcon },
  { key: 'line', label: 'Line', icon: HorizontalRuleIcon },
  { key: 'arrow', label: 'Arrow', icon: NorthEastIcon },
  { key: 'rect', label: 'Rectangle', icon: CropSquareIcon },
  { key: 'ellipse', label: 'Ellipse', icon: RadioButtonUncheckedIcon },
  { key: 'text', label: 'Text', icon: TextFieldsIcon },
  { key: 'eraser', label: 'Eraser', icon: BackspaceIcon },
]

const SHAPE_TOOLS = ['line', 'arrow', 'rect', 'ellipse']
const MAX_RENDER_WIDTH = 2200

const PDFAnnotateEditor = ({ page, source, index, total, stamps, onChange, onNavigate, onClose, onCancel }) => {
  const areaRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const draftRef = useRef(null)
  const erasingRef = useRef(false)
  const textRef = useRef(null)
  const pendingTextRef = useRef(null)
  const [area, setArea] = useState({ w: 0, h: 0 })
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(ANNOTATION_COLORS[1])
  const [sizeKey, setSizeKey] = useState('medium')
  const [draft, setDraft] = useState(null)
  const [textInput, setTextInput] = useState(null)

  const turns = (page.rotation / 90) % 4
  const dims = displayDims(page)
  const aspect = dims.w / dims.h
  const fitWidth = Math.max(0, Math.min(area.w, area.h * aspect))
  const fitHeight = fitWidth / aspect
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const sizeValue = ANNOTATION_SIZES.find((item) => item.key === sizeKey).value
  const { kind, sourceIndex, baseRotation, baseW, baseH, rotation, filter, annotations, skew } = page
  const cancelGesture = useCallback(() => {
    draftRef.current = null
    erasingRef.current = false
    setDraft(null)
  }, [])
  const zoom = useZoomPan({
    areaRef,
    containerW: area.w + 8,
    containerH: area.h + 8,
    fitWidth,
    fitHeight,
    onGestureStart: cancelGesture,
  })
  const renderWidth = Math.min(MAX_RENDER_WIDTH, Math.round(fitWidth * dpr * Math.min(3, Math.ceil(zoom.scale))))
  const renderHeight = Math.round(renderWidth / aspect)

  useEffect(() => {
    const node = areaRef.current
    if (!node) return undefined
    const measure = () => setArea({ w: node.clientWidth - 8, h: node.clientHeight - 8 })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || renderWidth < 20) return undefined
    let cancelled = false
    const descriptor = { kind, sourceIndex, baseRotation, baseW, baseH, rotation, filter, annotations: [], skew }
    renderDisplayCanvas(source, descriptor, { width: renderWidth, withAnnotations: false })
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
  }, [renderWidth, source, kind, sourceIndex, baseRotation, baseW, baseH, rotation, filter, skew])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || renderWidth < 20) return
    overlay.width = renderWidth
    overlay.height = renderHeight
    const context = overlay.getContext('2d')
    context.clearRect(0, 0, overlay.width, overlay.height)
    const list = draft ? [...annotations, draft] : annotations
    drawAnnotations(context, list, overlay.width, overlay.height, turns, { blend: false })
  }, [annotations, draft, renderWidth, renderHeight, turns])

  useEffect(() => {
    if (textInput && textRef.current) textRef.current.focus()
  }, [textInput])

  const toDisplay = (event) => {
    const bounds = stageRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    }
  }

  const toBase = (point) => rotatePoint(point, -turns)

  const eraseAt = (point) => {
    const base = toBase(point)
    const radius = page.baseW * 0.012
    const remaining = annotations.filter((item) => !annotationHit(item, base, radius, page))
    if (remaining.length !== annotations.length) onChange(page.id, remaining)
  }

  const commitText = (value, cancel) => {
    const pending = pendingTextRef.current
    pendingTextRef.current = null
    setTextInput(null)
    if (cancel || !pending) return
    const text = value.trim()
    if (!text) return
    onChange(page.id, [
      ...annotations,
      {
        id: newAnnotationId(),
        type: 'text',
        color,
        size: sizeValue * TEXT_MULTIPLIER,
        x: pending.base.x,
        y: pending.base.y,
        angle: (360 - page.rotation) % 360,
        text,
      },
    ])
  }

  const handlePointerDown = (event) => {
    if (textInput) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const point = toDisplay(event)
    const base = toBase(point)
    if (tool === 'text') {
      event.preventDefault()
      pendingTextRef.current = { display: point, base }
      setTextInput({ display: point, base })
      return
    }
    event.preventDefault()
    stageRef.current.setPointerCapture(event.pointerId)
    if (tool === 'eraser') {
      erasingRef.current = true
      eraseAt(point)
      return
    }
    let next
    if (tool === 'pen' || tool === 'highlight') {
      next = { id: newAnnotationId(), type: tool, color, width: sizeValue, points: [[base.x, base.y]] }
    } else {
      next = { id: newAnnotationId(), type: tool, color, width: sizeValue, x1: base.x, y1: base.y, x2: base.x, y2: base.y }
    }
    draftRef.current = next
    setDraft(next)
  }

  const handlePointerMove = (event) => {
    const point = toDisplay(event)
    if (erasingRef.current) {
      eraseAt(point)
      return
    }
    const current = draftRef.current
    if (!current) return
    const base = toBase(point)
    let next
    if (current.type === 'pen' || current.type === 'highlight') {
      const last = current.points[current.points.length - 1]
      if (Math.hypot((base.x - last[0]) * page.baseW, (base.y - last[1]) * page.baseH) < page.baseW * 0.002) return
      next = { ...current, points: [...current.points, [base.x, base.y]] }
    } else {
      next = { ...current, x2: base.x, y2: base.y }
    }
    draftRef.current = next
    setDraft(next)
  }

  const handlePointerUp = (event) => {
    if (stageRef.current && stageRef.current.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId)
    erasingRef.current = false
    const current = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (!current) return
    if (SHAPE_TOOLS.includes(current.type)) {
      const length = Math.hypot((current.x2 - current.x1) * page.baseW, (current.y2 - current.y1) * page.baseH)
      if (length < page.baseW * 0.005) return
    }
    onChange(page.id, [...annotations, current])
  }

  const unitCss = turns % 2 === 1 ? fitHeight : fitWidth
  const textFont = sizeValue * TEXT_MULTIPLIER * unitCss

  return (
    <div className="pe-editor">
      <div className="pe-editor-head">
        <div className="pe-editor-title">
          <strong>Annotate</strong>
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
          <button type="button" className="pe-btn ghost" onClick={() => onChange(page.id, [])} disabled={!annotations.length}>
            Clear page
          </button>
          <button type="button" className="pe-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="pe-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <div className="pe-palette">
        <div className="pe-palette-tools">
          {TOOLS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`pe-palette-btn ${tool === item.key ? 'active' : ''}`}
              onClick={() => setTool(item.key)}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon sx={{ fontSize: 18 }} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="pe-palette-options">
          <div className="pe-swatches">
            {ANNOTATION_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                className={`pe-swatch ${color === value ? 'active' : ''}`}
                style={{ background: value }}
                onClick={() => setColor(value)}
                aria-label={`Colour ${value}`}
              />
            ))}
            <label
              className={`pe-color-picker ${ANNOTATION_COLORS.includes(color) ? '' : 'active'}`}
              title="Custom colour"
              style={ANNOTATION_COLORS.includes(color) ? undefined : { '--pe-picked': color }}
            >
              <PaletteIcon sx={{ fontSize: 14 }} />
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Custom colour" />
            </label>
            <span className="pe-color-hex">{color.toUpperCase()}</span>
          </div>
          <div className="pe-segment">
            {ANNOTATION_SIZES.map((item) => (
              <button key={item.key} type="button" className={`pe-segment-btn ${sizeKey === item.key ? 'active' : ''}`} onClick={() => setSizeKey(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`pe-crop-area ${zoom.panning ? 'panning' : ''}`} ref={areaRef} {...zoom.bind}>
        {fitWidth > 0 && (
          <div className="pe-zoom-layer" style={zoom.layerStyle}>
          <div
            className={`pe-crop-stage pe-annot-stage ${tool === 'text' ? 'text-tool' : ''} ${tool === 'eraser' ? 'eraser-tool' : ''}`}
            ref={stageRef}
            style={{ width: '100%', height: '100%' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas ref={canvasRef} className="pe-crop-canvas" style={{ width: '100%', height: '100%' }} />
            <canvas ref={overlayRef} className="pe-annot-overlay" style={{ width: '100%', height: '100%' }} />
            <PDFStampOverlay page={page} index={index} total={total} stamps={stamps} pixelScale={Math.min(3, zoom.scale)} />
            {textInput && (
              <input
                ref={textRef}
                className="pe-annot-text"
                style={{
                  left: `${textInput.display.x * 100}%`,
                  top: `calc(${textInput.display.y * 100}% - ${textFont * 0.85}px)`,
                  fontSize: textFont,
                  color,
                  fontFamily: FONT_STACK,
                  lineHeight: 1,
                }}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter') commitText(event.currentTarget.value, false)
                  if (event.key === 'Escape') commitText('', true)
                }}
                onBlur={(event) => commitText(event.currentTarget.value, false)}
              />
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PDFAnnotateEditor
