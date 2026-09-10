import { createContext, useContext } from 'react'

export const PDFWindowContext = createContext(null)

export function usePDFWindows() {
  const ctx = useContext(PDFWindowContext)
  if (!ctx) throw new Error('usePDFWindows must be used within a PDFWindowProvider')
  return ctx
}
