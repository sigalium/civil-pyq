import { Suspense, lazy, useState } from 'react'
import { createPortal } from 'react-dom'
import PDFCompressionModal from './PDFCompressionModal'
import { editorAllowedFor } from '../utils/pdfEditor/capability'
import './css/PDFEditModal.css'

const PDFEditModal = lazy(() => import('./pdfEditor/PDFEditModal'))

const PDFToolModal = (props) => {
  const [compressionOnly, setCompressionOnly] = useState(false)
  const [editorAvailable] = useState(() => editorAllowedFor(props.file))

  if (!editorAvailable || compressionOnly) return <PDFCompressionModal {...props} />

  return (
    <Suspense
      fallback={createPortal(
        <div className="pe-overlay">
          <div className="pe-loading">Loading editor…</div>
        </div>,
        document.body
      )}
    >
      <PDFEditModal {...props} onUseCompression={() => setCompressionOnly(true)} />
    </Suspense>
  )
}

export default PDFToolModal
