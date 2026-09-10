import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import CloseIcon from '@mui/icons-material/Close'
import CompressIcon from '@mui/icons-material/Compress'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { COMPRESSION_PRESETS, compressPdf, formatBytes } from '../utils/pdfCompression'
import './css/PDFCompressionModal.css'

import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

const LIGHT_FILE_THRESHOLD_PER_PAGE = 220 * 1024

const PDFCompressionModal = ({ file, initialResult, onApply, onClose }) => {
  const [preset, setPreset] = useState('high')
  const [view, setView] = useState(initialResult ? 'compressed' : 'original')
  const [numPages, setNumPages] = useState(null)
  const [scale, setScale] = useState(1.0)
  const [compressing, setCompressing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(initialResult || null)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const displayedFile = view === 'compressed' && result ? result : file

  const runCompression = async () => {
    setCompressing(true)
    setError('')
    setResult(null)
    setProgress({ done: 0, total: numPages || 0 })
    try {
      const compressedFile = await compressPdf(file, preset, (done, total) => {
        if (mountedRef.current) setProgress({ done, total })
      })
      if (mountedRef.current) {
        setResult(compressedFile)
        setView('compressed')
      }
    } catch (err) {
      if (mountedRef.current) setError(err.message)
    }
    if (mountedRef.current) setCompressing(false)
  }

  const savings = result ? Math.round((1 - result.size / file.size) * 100) : null
  const grewInstead = result && result.size >= file.size

  const looksAlreadyEfficient = useMemo(() => {
    if (!numPages) return false
    return file.size / numPages < LIGHT_FILE_THRESHOLD_PER_PAGE
  }, [file, numPages])

  return (
    <div className="pdf-compress-overlay" onClick={() => !compressing && onClose()}>
      <div className="pdf-compress-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-compress-header">
          <span className="pdf-compress-title">
            <CompressIcon sx={{ fontSize: 20 }} /> Compress PDF
          </span>
          <button className="icon-btn" onClick={onClose} disabled={compressing} aria-label="Close">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="pdf-compress-body">
          <div className="pdf-compress-preview">
            <div className="pdf-compress-preview-toolbar">
              <div className="pdf-compress-view-toggle">
                <button className={view === 'original' ? 'active' : ''} onClick={() => setView('original')}>
                  Original
                </button>
                <button className={view === 'compressed' ? 'active' : ''} onClick={() => setView('compressed')} disabled={!result}>
                  Compressed
                </button>
              </div>
              <div className="pdf-compress-zoom">
                <button className="icon-btn" onClick={() => setScale((s) => Math.max(0.4, s - 0.2))} aria-label="Zoom out">
                  <ZoomOutIcon sx={{ fontSize: 16 }} />
                </button>
                <span>{Math.round(scale * 100)}%</span>
                <button className="icon-btn" onClick={() => setScale((s) => Math.min(3, s + 0.2))} aria-label="Zoom in">
                  <ZoomInIcon sx={{ fontSize: 16 }} />
                </button>
              </div>
            </div>

            <div className="pdf-compress-scroll-area">
              <Document
                key={view}
                file={displayedFile}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                loading={<div className="pdf-compress-preview-placeholder">Rendering…</div>}
                error={<div className="pdf-compress-preview-placeholder">Could not render this PDF.</div>}
              >
                {numPages &&
                  Array.from({ length: numPages }, (_, i) => (
                    <Page key={i + 1} pageNumber={i + 1} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
                  ))}
              </Document>
            </div>
          </div>

          <div className="pdf-compress-controls">
            <div className="pdf-compress-presets">
              {Object.entries(COMPRESSION_PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  className={`pdf-compress-preset ${preset === key ? 'active' : ''}`}
                  onClick={() => { setPreset(key); setResult(null) }}
                  disabled={compressing}
                >
                  {p.label}
                  <span>{p.dpi} DPI</span>
                </button>
              ))}
            </div>

            {looksAlreadyEfficient && !result && (
              <p className="pdf-compress-warning">
                <WarningAmberIcon sx={{ fontSize: 16 }} /> This file looks text-based and already small for its page count. Image compression usually makes files like this bigger, not smaller — you may want to skip compressing it.
              </p>
            )}

            <div className="pdf-compress-sizes">
              <div className="pdf-compress-size-row">
                <span>Original</span>
                <span>{formatBytes(file.size)}</span>
              </div>
              <div className="pdf-compress-size-row">
                <span>Compressed</span>
                <span>
                  {compressing
                    ? `Processing page ${progress.done}/${progress.total || '…'}`
                    : result
                      ? `${formatBytes(result.size)} (${savings >= 0 ? `${savings}% smaller` : `${Math.abs(savings)}% larger`})`
                      : '—'}
                </span>
              </div>
            </div>

            {grewInstead && (
              <p className="pdf-compress-warning">
                <WarningAmberIcon sx={{ fontSize: 16 }} /> This came out larger than the original. Text-heavy PDFs like this are often already smaller than any rasterized version — this file likely isn't a good candidate for image-based compression at any preset.
              </p>
            )}

            {error && <p className="dashboard-error">{error}</p>}

            <div className="pdf-compress-actions">
              <button className="action-btn preview-btn" onClick={runCompression} disabled={compressing}>
                {compressing ? 'Compressing…' : 'Compress'}
              </button>
              <button
                className="action-btn approve-btn"
                disabled={!result || compressing}
                onClick={() => onApply(result)}
              >
                Use compressed file
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PDFCompressionModal
