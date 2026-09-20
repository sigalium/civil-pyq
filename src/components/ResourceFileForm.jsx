import { useState } from 'react'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CompressIcon from '@mui/icons-material/Compress'
import { useAuth } from '../context/useAuth'
import { useNotifications } from '../context/useNotifications'
import { uploadResourceFile } from '../utils/resourceUpload'
import { formatBytes } from '../utils/pdfCompression'
import PDFCompressionModal from './PDFCompressionModal'

const ResourceFileForm = ({
  mode,
  semester,
  subject,
  type,
  namePlaceholder,
  initialName = '',
  initialPath = '',
  initialSize = null,
  onOpenPreview,
  onSubmit,
  onCancel,
}) => {
  const { profile } = useAuth()
  const canCompress = !!profile
  const { notify } = useNotifications()
  const [name, setName] = useState(initialName)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingOriginalFile, setPendingOriginalFile] = useState(null)
  const [pendingCompressedFile, setPendingCompressedFile] = useState(null)
  const [showCompress, setShowCompress] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')

  const busy = phase !== 'idle'
  const existingFileName = initialPath ? initialPath.split('/').pop() : ''
  const displayFileName = pendingFile ? pendingFile.name : existingFileName
  const displaySize = pendingFile ? pendingFile.size : initialSize

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setPendingFile(file)
    setPendingOriginalFile(file)
    setPendingCompressedFile(null)
  }

  const discardPendingFile = () => {
    setPendingFile(null)
    setPendingOriginalFile(null)
    setPendingCompressedFile(null)
  }

  const previewPendingFile = () => {
    if (!pendingFile) return
    onOpenPreview({ name: pendingFile.name, path: URL.createObjectURL(pendingFile) })
  }

  const submit = async () => {
    if (!name.trim()) return
    if (mode === 'add' && !pendingFile) return
    setError('')
    let finalPath = initialPath
    let finalSize = initialSize
    try {
      if (pendingFile) {
        setPhase('uploading')
        finalPath = await uploadResourceFile({ file: pendingFile, semester, subject, type, label: name.trim() })
        finalSize = pendingFile.size
      }
      setPhase('saving')
      await onSubmit({ name: name.trim(), path: finalPath, fileSize: finalSize, fileChanged: !!pendingFile })
      notify({ variant: 'success', message: mode === 'add' ? `"${name.trim()}" added.` : `"${name.trim()}" saved.` })
    } catch (err) {
      setError(err.message)
      setPhase('idle')
      return
    }
    setPhase('idle')
  }

  return (
    <div className="resource-file-form">
      <input
        className="resource-file-form-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={namePlaceholder}
        disabled={busy}
        autoFocus={mode === 'add'}
      />
      <div className="resource-file-form-file">
        <label className="file-upload-btn">
          {mode === 'edit' ? 'Replace file' : (pendingFile ? 'Choose different PDF' : 'Choose PDF')}
          <input type="file" accept="application/pdf" onChange={handleFileSelect} disabled={busy} hidden />
        </label>
        {displayFileName ? (
          <span className="resource-file-form-status">
            <span className="resource-file-form-filename">{displayFileName}</span>
            {displaySize != null && <span className="resource-file-form-size">{formatBytes(displaySize)}</span>}
          </span>
        ) : (
          <span className="resource-file-form-status resource-file-form-placeholder">No file chosen</span>
        )}
        {pendingFile && (
          <div className="resource-file-form-pending-actions">
            <button type="button" className="icon-btn" onClick={previewPendingFile} disabled={busy} aria-label="Preview PDF" title="Preview PDF">
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </button>
            {canCompress && (
              <button type="button" className="icon-btn" onClick={() => setShowCompress(true)} disabled={busy} aria-label="Compress PDF" title="Compress PDF">
                <CompressIcon sx={{ fontSize: 16 }} />
              </button>
            )}
            <button type="button" className="action-btn reject-btn" disabled={busy} onClick={discardPendingFile}>Discard</button>
          </div>
        )}
      </div>
      {error && <span className="dashboard-error">{error}</span>}
      <div className="resource-file-form-actions">
        <button
          className="action-btn approve-btn"
          disabled={busy || !name.trim() || (mode === 'add' && !pendingFile)}
          onClick={submit}
        >
          {phase === 'uploading' ? 'Uploading…' : phase === 'saving' ? 'Saving…' : mode === 'add' ? 'Add' : 'Save'}
        </button>
        <button className="action-btn reject-btn" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
      {showCompress && pendingFile && (
        <PDFCompressionModal
          file={pendingOriginalFile}
          initialResult={pendingCompressedFile}
          onApply={(compressedFile) => { setPendingFile(compressedFile); setPendingCompressedFile(compressedFile); setShowCompress(false) }}
          onClose={() => setShowCompress(false)}
        />
      )}
    </div>
  )
}

export default ResourceFileForm
