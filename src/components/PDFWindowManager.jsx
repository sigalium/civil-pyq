import { useEffect, useRef, useState } from 'react'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import CloseIcon from '@mui/icons-material/Close'
import PDFViewer from './PDFViewer'
import { usePDFWindows } from '../context/PDFWindowContext'
import './css/PDFWindowManager.css'

const GRID_AREAS = {
  1: { columns: '1fr', rows: '1fr', areas: '"a"' },
  2: { columns: '1fr 1fr', rows: '1fr', areas: '"a b"' },
  3: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a b" "c c"' },
  4: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a b" "c d"' },
}
const CELL_NAMES = ['a', 'b', 'c', 'd']

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 800px)').matches)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 800px)')
    const handler = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}

const PDFWindowManager = () => {
  const { windows, closePdf, minimizePdf, restorePdf, focusPdf } = usePDFWindows()
  const isMobile = useIsMobile()
  const hasPushedRef = useRef(false)

  const visibleWindows = windows.filter((w) => !w.minimized)
  const topWindow = [...visibleWindows].sort((a, b) => b.zIndex - a.zIndex)[0]
  const allClosing = visibleWindows.length > 0 && visibleWindows.every((w) => w.closing)

  useEffect(() => {
    if (visibleWindows.length > 0 && !hasPushedRef.current) {
      try {
        window.history.pushState({ __pdfWindows: true }, '')
        hasPushedRef.current = true
      } catch {
        hasPushedRef.current = false
      }
    } else if (visibleWindows.length === 0) {
      hasPushedRef.current = false
    }
  }, [visibleWindows.length])

  useEffect(() => {
    const handlePopState = () => {
      if (!hasPushedRef.current) return
      const visible = windows.filter((w) => !w.minimized)
      if (visible.length === 0) {
        hasPushedRef.current = false
        return
      }
      const top = [...visible].sort((a, b) => b.zIndex - a.zIndex)[0]
      closePdf(top.id)
      if (visible.length > 1) {
        try {
          window.history.pushState({ __pdfWindows: true }, '')
        } catch {
          hasPushedRef.current = false
        }
      } else {
        hasPushedRef.current = false
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [windows, closePdf])

  if (windows.length === 0) return null

  if (isMobile) {
    const win = visibleWindows[0]
    if (!win) return null
    return (
      <PDFViewer
        pdfName={win.name}
        pdfPath={win.path}
        onClose={() => closePdf(win.id)}
        closeOnOutsideClick={false}
        isFocused
        externalClosing={!!win.closing}
      />
    )
  }

  const layout = GRID_AREAS[Math.min(visibleWindows.length, 4)] || GRID_AREAS[1]
  const count = visibleWindows.length

  const handleBackdropClick = (e) => {
    if (e.target.closest('.pdf-window-cell') || e.target.closest('.pdf-taskbar')) return
    if (topWindow) minimizePdf(topWindow.id)
  }

  const taskbar = (
    <div className="pdf-taskbar">
      {windows.map((win) => (
        <div
          key={win.id}
          className={`pdf-taskbar-item ${!win.minimized && topWindow?.id === win.id ? 'active' : ''}`}
          onClick={() => (win.minimized ? restorePdf(win.id) : focusPdf(win.id))}
        >
          <PictureAsPdfIcon sx={{ fontSize: 16 }} />
          <span className="pdf-taskbar-label">{win.name}</span>
          <button
            className="pdf-taskbar-close"
            onClick={(e) => { e.stopPropagation(); closePdf(win.id) }}
            aria-label="Close"
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </button>
        </div>
      ))}
    </div>
  )

  if (count === 0) {
    return <div className="pdf-taskbar-only">{taskbar}</div>
  }

  return (
    <div className={`pdf-window-backdrop ${allClosing ? 'closing' : ''}`} onMouseDown={handleBackdropClick}>
      <div
        className={`pdf-window-grid count-${count}`}
        style={
          count === 1
            ? undefined
            : { gridTemplateColumns: layout.columns, gridTemplateRows: layout.rows, gridTemplateAreas: layout.areas }
        }
      >
        {visibleWindows.map((win, index) => (
          <div
            key={win.id}
            className={`pdf-window-cell ${count === 1 ? 'single' : ''}`}
            style={count === 1 ? undefined : { gridArea: CELL_NAMES[index] }}
            onMouseDownCapture={() => focusPdf(win.id)}
          >
            <PDFViewer
              pdfName={win.name}
              pdfPath={win.path}
              onClose={() => closePdf(win.id)}
              onMinimize={() => minimizePdf(win.id)}
              windowed
              closeOnOutsideClick={false}
              isFocused={topWindow?.id === win.id}
              externalClosing={!!win.closing}
            />
          </div>
        ))}
      </div>

      {taskbar}
    </div>
  )
}

export default PDFWindowManager
