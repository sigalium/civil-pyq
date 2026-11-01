import { useEffect, useRef, useState } from 'react'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import CropIcon from '@mui/icons-material/Crop'
import BorderColorIcon from '@mui/icons-material/BorderColor'
import DeleteIcon from '@mui/icons-material/Delete'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import { displayDims } from '../../utils/pdfEditor/geometry'
import { renderDisplayCanvas } from '../../utils/pdfEditor/sources'
import { useZoomPan } from './useZoomPan'
import PDFStampOverlay from './PDFStampOverlay'

const MAX_RENDER_WIDTH = 2400

const PDFPageViewer = ({ page, source, index, total, stamps, canDelete, onNavigate, onClose, onRotate, onCrop, onAnnotate, onDelete }) => {
  const areaRef = useRef(null)
  const canvasRef = useRef(null)
  const [area, setArea] = useState({ w: 0, h: 0 })

  const dims = displayDims(page)
  const aspect = dims.w / dims.h
  const fitWidth = Math.max(0, Math.min(area.w, area.h * aspect))
  const fitHeight = fitWidth / aspect
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  const zoom = useZoomPan({
    areaRef,
    containerW: area.w + 8,
    containerH: area.h + 8,
    fitWidth,
    fitHeight,
  })

  const renderWidth = Math.min(MAX_RENDER_WIDTH, Math.round(fitWidth * dpr * Math.min(3, Math.ceil(zoom.scale))))

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
    renderDisplayCanvas(source, page, { width: renderWidth })
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
  }, [renderWidth, source, page])

  return (
    <div className="pe-editor">
      <div className="pe-editor-head pe-view-head">
        <div className="pe-editor-title">
          <button type="button" className="pe-btn" onClick={onClose}>
            <FullscreenExitIcon sx={{ fontSize: 18 }} /> All pages
          </button>
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
          <button type="button" className="pe-icon-btn" onClick={() => onRotate(page.id, -90)} aria-label="Rotate left" title="Rotate left">
            <RotateLeftIcon sx={{ fontSize: 18 }} />
          </button>
          <button type="button" className="pe-icon-btn" onClick={() => onRotate(page.id, 90)} aria-label="Rotate right" title="Rotate right">
            <RotateRightIcon sx={{ fontSize: 18 }} />
          </button>
          <button type="button" className="pe-btn" onClick={() => onCrop(page.id)}>
            <CropIcon sx={{ fontSize: 16 }} /> Crop
          </button>
          <button type="button" className="pe-btn" onClick={() => onAnnotate(page.id)}>
            <BorderColorIcon sx={{ fontSize: 16 }} /> Annotate
          </button>
          <button type="button" className="pe-btn danger" onClick={() => onDelete(page.id)} disabled={!canDelete}>
            <DeleteIcon sx={{ fontSize: 16 }} /> Delete
          </button>
        </div>
      </div>

      <div className={`pe-crop-area ${zoom.panning ? 'panning' : ''}`} ref={areaRef} {...zoom.bind}>
        {fitWidth > 0 && (
          <div className="pe-zoom-layer" style={zoom.layerStyle}>
            <div className="pe-crop-stage pe-view-stage" style={{ width: '100%', height: '100%' }}>
              <canvas ref={canvasRef} className="pe-crop-canvas" style={{ width: '100%', height: '100%' }} />
              <PDFStampOverlay page={page} index={index} total={total} stamps={stamps} pixelScale={Math.min(3, zoom.scale)} />
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
          </div>
        )}
      </div>
    </div>
  )
}

export default PDFPageViewer
