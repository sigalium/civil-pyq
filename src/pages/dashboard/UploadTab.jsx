import { useRef, useState } from 'react'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import CompressIcon from '@mui/icons-material/Compress'
import Select from '../../components/Select'
import PDFCompressionModal from '../../components/PDFCompressionModal'
import ConfirmModal from '../../components/ConfirmModal'
import { useResourcesData } from '../../context/useResourcesData'
import { useAuth } from '../../context/useAuth'
import { buildStagingRepoPath } from '../../utils/resourceSnippet'
import { uploadFileToGithub } from '../../utils/githubUpload'
import { recordReplacedFile } from '../../utils/replacedFiles'
import { insertResourceOnTop } from '../../utils/resourceOrdering'
import { supabase } from '../../lib/supabaseClient'
import './Dashboard.css'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const TYPE_OPTIONS = [
  { value: 'pyq', label: 'Previous Year Question' },
  { value: 'lab', label: 'Lab Manual / Notes' },
  { value: 'syllabus', label: 'Syllabus' },
]
const MAX_FILES = 20
const MAX_TOTAL_BYTES = 150 * 1024 * 1024

let idCounter = 0
const nextId = () => {
  idCounter += 1
  return idCounter
}

function guessType(fileName) {
  const lower = fileName.toLowerCase()
  if (lower.includes('syllabus')) return 'syllabus'
  if (lower.includes('lab') || lower.includes('manual')) return 'lab'
  return 'pyq'
}

function guessSubject(fileName, subjectRows) {
  const lower = fileName.toLowerCase()
  const match = subjectRows.find((row) => lower.includes(row.name.toLowerCase().replace(/\s+/g, '')))
  return match || null
}

function guessLabel(fileName) {
  return fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim()
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

const UploadTab = () => {
  const { subjectRows, refresh } = useResourcesData()
  const { profile } = useAuth()
  const canCompress = !!profile
  const [staged, setStaged] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [compressingEntryId, setCompressingEntryId] = useState(null)
  const fileInputRef = useRef(null)

  const addFiles = (fileList) => {
    setGlobalError('')
    const incoming = Array.from(fileList).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (incoming.length === 0) return

    const currentTotal = staged.reduce((sum, s) => sum + s.file.size, 0)
    const incomingTotal = incoming.reduce((sum, f) => sum + f.size, 0)

    if (staged.length + incoming.length > MAX_FILES) {
      setGlobalError(`You can stage up to ${MAX_FILES} files at once. Publish or remove some before adding more.`)
      return
    }
    if (currentTotal + incomingTotal > MAX_TOTAL_BYTES) {
      setGlobalError(`Staged files can't exceed ${formatBytes(MAX_TOTAL_BYTES)} in total.`)
      return
    }

    const newEntries = incoming.map((file) => {
      const guessedSubject = guessSubject(file.name, subjectRows)
      return {
        id: nextId(),
        file,
        originalFile: file,
        compressedFile: null,
        semester: guessedSubject?.semester || '',
        subject: guessedSubject?.name || '',
        type: guessType(file.name),
        label: guessLabel(file.name),
        status: 'pending',
        error: '',
      }
    })

    setStaged((prev) => [...prev, ...newEntries])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    addFiles(e.dataTransfer.files)
  }

  const updateEntry = (id, patch) => {
    setStaged((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }

  const [confirmRemoveId, setConfirmRemoveId] = useState(null)

  const removeEntry = (id) => {
    setStaged((prev) => prev.filter((entry) => entry.id !== id))
    setConfirmRemoveId(null)
  }

  const applyCompression = (id, compressedFile) => {
    updateEntry(id, { file: compressedFile, compressedFile })
    setCompressingEntryId(null)
  }

  const clearFinished = () => {
    setStaged((prev) => prev.filter((entry) => entry.status !== 'done'))
  }

  const subjectOptionsFor = (semester) =>
    subjectRows
      .filter((row) => row.semester === Number(semester) && !row.deleted_at)
      .map((row) => ({ value: row.name, label: row.name }))

  const publishAll = async () => {
    setGlobalError('')
    const readyEntries = staged.filter((e) => e.status !== 'done')
    const invalid = readyEntries.some((e) => !e.semester || !e.subject || !e.type || !e.label.trim())
    if (invalid) {
      setGlobalError('Every staged file needs a semester, subject, type, and label before publishing.')
      return
    }

    setPublishing(true)

    for (const entry of readyEntries) {
      updateEntry(entry.id, { status: 'uploading', error: '' })
      try {
        const url = await uploadFileToGithub({
          file: entry.file,
          repoPath: buildStagingRepoPath({
            semester: entry.semester,
            subject: entry.subject,
            resource_type: entry.type,
            resource_label: entry.label,
            file_path: entry.file.name,
          }),
          commitMessage: `Add ${entry.label} (Sem ${entry.semester} - ${entry.subject})`,
        })

        if (entry.type === 'syllabus') {
          const { data: existingSyllabus } = await supabase
            .from('resources')
            .select('path, file_size_bytes')
            .eq('subject', entry.subject)
            .eq('semester', entry.semester)
            .eq('resource_type', 'syllabus')
          for (const oldRow of existingSyllabus || []) {
            await recordReplacedFile({
              oldUrl: oldRow.path,
              resourceName: `Syllabus - Sem ${entry.semester} - ${entry.subject}`,
              resourceType: 'syllabus',
              fileSizeBytes: oldRow.file_size_bytes,
            })
          }
          await supabase
            .from('resources')
            .delete()
            .eq('subject', entry.subject)
            .eq('semester', entry.semester)
            .eq('resource_type', 'syllabus')
          await supabase.from('resources').insert({
            semester: entry.semester,
            subject: entry.subject,
            resource_type: 'syllabus',
            name: 'Syllabus',
            path: url,
            file_size_bytes: entry.file.size,
          })
        } else {
          await insertResourceOnTop({
            semester: entry.semester,
            subject: entry.subject,
            resource_type: entry.type,
            name: entry.label,
            path: url,
            file_size_bytes: entry.file.size,
          })
        }

        updateEntry(entry.id, { status: 'done' })
      } catch (err) {
        updateEntry(entry.id, { status: 'error', error: err.message })
      }
    }

    setPublishing(false)
    refresh()
  }

  const doneCount = staged.filter((e) => e.status === 'done').length
  const errorCount = staged.filter((e) => e.status === 'error').length

  return (
    <div className="dashboard-panel">
      <p className="snippet-hint">
        Upload and publish up to {MAX_FILES} PDFs at once.
      </p>

      <div
        className={`bulk-dropzone ${dragActive ? 'active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUploadIcon sx={{ fontSize: 34 }} />
        <p>Drag & drop PDFs here, or click to choose files</p>
        <span className="bulk-dropzone-hint">Up to {MAX_FILES} files, {formatBytes(MAX_TOTAL_BYTES)} total</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {globalError && <p className="dashboard-error">{globalError}</p>}

      {staged.length > 0 && (
        <>
          <div className="bulk-staged-list">
            {staged.map((entry) => (
              <div className="bulk-staged-row" key={entry.id}>
                <div className="bulk-staged-status">
                  {entry.status === 'done' && <CheckCircleIcon sx={{ fontSize: 20 }} className="status-success" />}
                  {entry.status === 'error' && <ErrorIcon sx={{ fontSize: 20 }} className="status-danger" />}
                  {entry.status === 'uploading' && <span className="bulk-spinner" />}
                  {entry.status === 'pending' && <span className="bulk-status-dot" />}
                </div>

                <div className="bulk-staged-main">
                  <div className="bulk-staged-filename" title={entry.file.name}>
                    <span className="bulk-staged-filename-text">{entry.file.name}</span>
                    <span className="bulk-staged-size">({formatBytes(entry.file.size)})</span>
                  </div>
                  <input
                    className="bulk-label-input"
                    value={entry.label}
                    onChange={(e) => updateEntry(entry.id, { label: e.target.value })}
                    placeholder="Label (e.g. ESE Dec 2025)"
                    disabled={entry.status === 'done' || entry.status === 'uploading'}
                  />
                  {entry.error && <span className="dashboard-error">{entry.error}</span>}
                </div>

                <div className="bulk-staged-fields">
                  <Select
                    value={entry.semester}
                    onChange={(v) => updateEntry(entry.id, { semester: Number(v), subject: '' })}
                    options={SEMESTERS.map((s) => ({ value: s, label: `Sem ${s}` }))}
                    placeholder="Semester"
                    disabled={entry.status === 'done' || entry.status === 'uploading'}
                  />
                  <Select
                    value={entry.subject}
                    onChange={(v) => updateEntry(entry.id, { subject: v })}
                    options={subjectOptionsFor(entry.semester)}
                    placeholder="Subject"
                    disabled={!entry.semester || entry.status === 'done' || entry.status === 'uploading'}
                  />
                  <Select
                    value={entry.type}
                    onChange={(v) => updateEntry(entry.id, { type: v })}
                    options={TYPE_OPTIONS}
                    placeholder="Type"
                    disabled={entry.status === 'done' || entry.status === 'uploading'}
                  />
                </div>

                <div className="bulk-staged-actions">
                  {canCompress && (
                    <button
                      className="icon-btn"
                      onClick={() => setCompressingEntryId(entry.id)}
                      disabled={entry.status === 'done' || entry.status === 'uploading'}
                      aria-label="Compress PDF"
                      title="Compress PDF"
                    >
                      <CompressIcon sx={{ fontSize: 18 }} />
                    </button>
                  )}
                  <button
                    className="icon-btn danger"
                    onClick={() => setConfirmRemoveId(entry.id)}
                    disabled={entry.status === 'uploading'}
                    aria-label="Remove"
                  >
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bulk-actions">
            <span className="bulk-summary">
              {staged.length} staged{doneCount > 0 ? ` · ${doneCount} published` : ''}{errorCount > 0 ? ` · ${errorCount} failed` : ''}
            </span>
            <div className="bulk-actions-buttons">
              {doneCount > 0 && (
                <button className="action-btn reject-btn" onClick={clearFinished} disabled={publishing}>
                  Clear published
                </button>
              )}
              <button className="action-btn approve-btn" onClick={publishAll} disabled={publishing || staged.every((e) => e.status === 'done')}>
                {publishing ? 'Publishing…' : 'Publish all'}
              </button>
            </div>
          </div>
        </>
      )}

      {compressingEntryId && (
        <PDFCompressionModal
          file={staged.find((e) => e.id === compressingEntryId)?.originalFile}
          initialResult={staged.find((e) => e.id === compressingEntryId)?.compressedFile || null}
          onApply={(compressedFile) => applyCompression(compressingEntryId, compressedFile)}
          onClose={() => setCompressingEntryId(null)}
        />
      )}
      {confirmRemoveId && (
        <ConfirmModal
          title="Remove this file?"
          message="It will be removed from this staged batch. Nothing has been uploaded yet."
          confirmLabel="Remove"
          onConfirm={() => removeEntry(confirmRemoveId)}
          onCancel={() => setConfirmRemoveId(null)}
        />
      )}
    </div>
  )
}

export default UploadTab
