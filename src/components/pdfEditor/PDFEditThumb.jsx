import { memo, useEffect, useRef, useState } from 'react'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import CropIcon from '@mui/icons-material/Crop'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import BorderColorIcon from '@mui/icons-material/BorderColor'
import TuneIcon from '@mui/icons-material/Tune'
import StraightenIcon from '@mui/icons-material/Straighten'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import PDFStampOverlay from './PDFStampOverlay'
import { displayDims } from '../../utils/pdfEditor/geometry'
import { enqueueRender, renderBaseCanvas } from '../../utils/pdfEditor/sources'

const PDFEditThumb = ({
  page,
  index,
  source,
  selected,
  size,
  stamps,
  total,
  dropSide,
  scrollRoot,
  onSelect,
  onRotate,
  onCrop,
  onDelete,
  onFullscreen,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  const dims = displayDims(page)
  const boxHeight = Math.round(size * 1.36)
  const aspect = dims.w / dims.h
  const pageWidth = Math.min(size, boxHeight * aspect)
  const pageHeight = pageWidth / aspect
  const sideways = (page.rotation / 90) % 2 === 1
  const canvasWidth = sideways ? pageHeight : pageWidth
  const canvasHeight = sideways ? pageWidth : pageHeight
  const targetPx = Math.min(2000, Math.ceil((canvasWidth * dpr) / 100) * 100)
  const { kind, sourceIndex, baseRotation, baseW, baseH, filter, annotations, skew } = page

  useEffect(() => {
    const node = stageRef.current
    if (!node || !scrollRoot) return undefined
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: scrollRoot,
      rootMargin: '600px 0px',
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    if (!visible) {
      canvas.width = 0
      canvas.height = 0
      return undefined
    }
    const token = { cancelled: false }
    const descriptor = { kind, sourceIndex, baseRotation, baseW, baseH, rotation: 0, skew }
    enqueueRender(() => renderBaseCanvas(source, descriptor, { width: targetPx, filter, annotations }), token)
      .then((rendered) => {
        if (!rendered) return
        if (token.cancelled) {
          rendered.width = 0
          return
        }
        canvas.width = rendered.width
        canvas.height = rendered.height
        canvas.getContext('2d').drawImage(rendered, 0, 0)
        rendered.width = 0
        setFailed(false)
      })
      .catch(() => {
        if (!token.cancelled) setFailed(true)
      })
    return () => {
      token.cancelled = true
    }
  }, [visible, targetPx, source, kind, sourceIndex, baseRotation, baseW, baseH, filter, annotations, skew])

  const handleClick = (event) => onSelect(page.id, { additive: event.ctrlKey || event.metaKey, range: event.shiftKey })

  const stop = (handler) => (event) => {
    event.stopPropagation()
    handler(page.id)
  }

  return (
    <div
      className={`pe-thumb ${selected ? 'selected' : ''} ${dropSide ? `drop-${dropSide}` : ''}`}
      style={{ width: size }}
      draggable
      onClick={handleClick}
      onDoubleClick={stop(onFullscreen)}
      onDragStart={(event) => onDragStart(event, page.id)}
      onDragOver={(event) => onDragOver(event, index)}
      onDrop={(event) => onDrop(event, index)}
      onDragEnd={onDragEnd}
    >
      <div className="pe-thumb-stage" ref={stageRef} style={{ height: boxHeight }}>
        <div className="pe-thumb-page" style={{ width: pageWidth, height: pageHeight }}>
          <canvas
            ref={canvasRef}
            className="pe-thumb-canvas"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `translate(-50%, -50%) rotate(${page.rotation}deg)`,
            }}
          />
          {failed && <span className="pe-thumb-failed">Unavailable</span>}
          <PDFStampOverlay page={page} index={index} total={total} stamps={stamps} />
          {page.crop && (
            <div
              className="pe-thumb-crop"
              style={{
                left: `${page.crop.x * 100}%`,
                top: `${page.crop.y * 100}%`,
                width: `${page.crop.w * 100}%`,
                height: `${page.crop.h * 100}%`,
              }}
            />
          )}
        </div>
        {(page.crop || annotations.length > 0 || filter !== 'original' || skew !== 0) && (
          <div className="pe-thumb-badges">
            {page.crop && (
              <span title="Cropped">
                <CropIcon sx={{ fontSize: 12 }} />
              </span>
            )}
            {annotations.length > 0 && (
              <span title="Annotated">
                <BorderColorIcon sx={{ fontSize: 12 }} />
              </span>
            )}
            {filter !== 'original' && (
              <span title="Filtered">
                <TuneIcon sx={{ fontSize: 12 }} />
              </span>
            )}
            {skew !== 0 && (
              <span title="Straightened">
                <StraightenIcon sx={{ fontSize: 12 }} />
              </span>
            )}
          </div>
        )}
        <span
          className={`pe-thumb-check ${selected ? 'on' : ''}`}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(page.id, { additive: true, range: false })
          }}
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select page ${index + 1}`}
        >
          {selected && <CheckIcon sx={{ fontSize: 14 }} />}
        </span>
        <button type="button" className="pe-thumb-full" onClick={stop(onFullscreen)} aria-label="Open page full screen" title="Open full screen">
          <FullscreenIcon sx={{ fontSize: 22 }} />
        </button>
        <div className="pe-thumb-actions">
          <button type="button" onClick={stop((id) => onRotate(id, -90))} aria-label="Rotate left" title="Rotate left">
            <RotateLeftIcon sx={{ fontSize: 16 }} />
          </button>
          <button type="button" onClick={stop((id) => onRotate(id, 90))} aria-label="Rotate right" title="Rotate right">
            <RotateRightIcon sx={{ fontSize: 16 }} />
          </button>
          <button type="button" onClick={stop(onCrop)} aria-label="Crop" title="Crop">
            <CropIcon sx={{ fontSize: 16 }} />
          </button>
          <button type="button" onClick={stop(onDelete)} aria-label="Delete page" title="Delete page">
            <DeleteIcon sx={{ fontSize: 16 }} />
          </button>
        </div>
      </div>
      <span className="pe-thumb-label">{index + 1}</span>
    </div>
  )
}

export default memo(PDFEditThumb)
