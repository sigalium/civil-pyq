import { createContext, useCallback, useContext, useRef, useState } from 'react'

const PDFWindowContext = createContext(null)
const MAX_WINDOWS = 4

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches
}

export function PDFWindowProvider({ children }) {
  const [windows, setWindows] = useState([])
  const idRef = useRef(0)
  const zRef = useRef(10)

  const openPdf = useCallback(({ name, path }) => {
    if (!path) return
    setWindows((prev) => {
      const existing = prev.find((w) => w.path === path)
      if (existing) {
        zRef.current += 1
        return prev.map((w) => (w.id === existing.id ? { ...w, minimized: false, closing: false, zIndex: zRef.current } : w))
      }

      idRef.current += 1
      zRef.current += 1
      const entry = { id: idRef.current, name, path, minimized: false, closing: false, zIndex: zRef.current }

      if (isMobileViewport()) {
        return [entry]
      }

      let next = prev
      if (prev.length >= MAX_WINDOWS) {
        next = prev.slice(1)
      }
      return [...next, entry]
    })
  }, [])

  const closePdf = useCallback((id) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, closing: true } : w)))
    setTimeout(() => {
      setWindows((prev) => prev.filter((w) => !(w.id === id && w.closing)))
    }, 340)
  }, [])

  const closeAllPdfs = useCallback(() => {
    setWindows([])
  }, [])

  const minimizePdf = useCallback((id) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)))
  }, [])

  const restorePdf = useCallback((id) => {
    zRef.current += 1
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: false, zIndex: zRef.current } : w)))
  }, [])

  const focusPdf = useCallback((id) => {
    zRef.current += 1
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, zIndex: zRef.current } : w)))
  }, [])

  const value = { windows, openPdf, closePdf, closeAllPdfs, minimizePdf, restorePdf, focusPdf, maxWindows: MAX_WINDOWS }

  return <PDFWindowContext.Provider value={value}>{children}</PDFWindowContext.Provider>
}

export function usePDFWindows() {
  const ctx = useContext(PDFWindowContext)
  if (!ctx) throw new Error('usePDFWindows must be used within a PDFWindowProvider')
  return ctx
}
