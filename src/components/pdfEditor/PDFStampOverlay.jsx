import { useEffect, useRef } from 'react'
import { displayDims } from '../../utils/pdfEditor/geometry'
import { computeStamps, drawStampsOnCanvas, stampsActive } from '../../utils/pdfEditor/stamps'

const PDFStampOverlay = ({ page, index, total, stamps, pixelScale = 1 }) => {
  const boxRef = useRef(null)
  const canvasRef = useRef(null)
  const active = stampsActive(stamps)
  const dims = displayDims(page)
  const crop = page.crop
  const visibleW = dims.w * (crop ? crop.w : 1)
  const visibleH = dims.h * (crop ? crop.h : 1)

  useEffect(() => {
    const box = boxRef.current
    const canvas = canvasRef.current
    if (!active || !box || !canvas) return undefined
    const draw = () => {
      const width = box.clientWidth
      if (!width) return
      const density = Math.min(window.devicePixelRatio || 1, 2) * pixelScale
      canvas.width = Math.max(1, Math.round(width * density))
      canvas.height = Math.max(1, Math.round((width * density * visibleH) / visibleW))
      const context = canvas.getContext('2d')
      const scale = canvas.width / visibleW
      const list = computeStamps({
        width: visibleW,
        height: visibleH,
        index,
        total,
        stamps,
        measure: (text, size) => {
          context.font = `${size * scale}px Helvetica, Arial, sans-serif`
          return context.measureText(text).width / scale
        },
      })
      drawStampsOnCanvas(context, list, scale)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(box)
    return () => observer.disconnect()
  }, [active, stamps, index, total, visibleW, visibleH, pixelScale])

  if (!active) return null

  return (
    <div
      ref={boxRef}
      className="pe-stamp-box"
      style={{
        left: `${(crop ? crop.x : 0) * 100}%`,
        top: `${(crop ? crop.y : 0) * 100}%`,
        width: `${(crop ? crop.w : 1) * 100}%`,
        height: `${(crop ? crop.h : 1) * 100}%`,
      }}
    >
      <canvas ref={canvasRef} className="pe-stamp-canvas" />
    </div>
  )
}

export default PDFStampOverlay
