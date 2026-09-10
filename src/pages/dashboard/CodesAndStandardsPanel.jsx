import { useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import CompressIcon from '@mui/icons-material/Compress'
import { useResourcesData } from '../../context/useResourcesData'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabaseClient'
import { uploadFileToGithub } from '../../utils/githubUpload'
import { buildCodeRepoPath } from '../../utils/resourceSnippet'
import { insertCodeOnTop } from '../../utils/isCodesOrdering'
import { persistOrder } from '../../utils/resourceOrdering'
import { formatBytes } from '../../utils/pdfCompression'
import PDFCompressionModal from '../../components/PDFCompressionModal'
import ConfirmModal from '../../components/ConfirmModal'
import Select from '../../components/Select'
import './Dashboard.css'

async function uploadCodeFile(file, name, sectionName) {
  const repoPath = buildCodeRepoPath({ name, fileName: file.name, sectionName })
  return uploadFileToGithub({ file, repoPath, commitMessage: `Add code: ${name}` })
}

const SectionsManager = ({ sections, onChanged }) => {
  const [order, setOrder] = useState(sections)
  const [dirty, setDirty] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [syncedIds, setSyncedIds] = useState(sections.map((s) => s.id).join(','))
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const freshIds = sections.map((s) => s.id).join(',')
  if (!dirty && freshIds !== syncedIds) {
    setOrder(sections)
    setSyncedIds(freshIds)
  }

  const handleReorder = (newOrder) => {
    setOrder(newOrder)
    setDirty(true)
  }

  const confirmOrder = async () => {
    setCommitting(true)
    await persistOrder('sections', order)
    setCommitting(false)
    setDirty(false)
    onChanged()
  }

  const cancelOrder = () => {
    setOrder(sections)
    setDirty(false)
  }

  const addSection = async () => {
    if (!newName.trim()) return
    await supabase.from('sections').insert({ name: newName.trim(), sort_order: sections.length })
    setNewName('')
    setAdding(false)
    onChanged()
  }

  const saveRename = async (id) => {
    if (!renameValue.trim()) return
    await supabase.from('sections').update({ name: renameValue.trim() }).eq('id', id)
    setRenamingId(null)
    onChanged()
  }

  const deleteSection = async (id) => {
    await supabase.from('sections').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setConfirmDeleteId(null)
    onChanged()
  }

  return (
    <div className="resource-group sections-manager">
      <h4>Sections</h4>
      {dirty && (
        <div className="reorder-confirm-bar">
          <span>Order changed</span>
          <button className="icon-btn success" onClick={confirmOrder} disabled={committing} aria-label="Confirm order"><CheckIcon sx={{ fontSize: 18 }} /></button>
          <button className="icon-btn danger" onClick={cancelOrder} disabled={committing} aria-label="Cancel"><CloseIcon sx={{ fontSize: 18 }} /></button>
        </div>
      )}
      <Reorder.Group as="div" axis="y" values={order} onReorder={handleReorder} className="draggable-list">
        {order.map((section) => (
          <SectionRow
            key={section.id}
            section={section}
            renaming={renamingId === section.id}
            renameValue={renameValue}
            onStartRename={() => { setRenamingId(section.id); setRenameValue(section.name) }}
            onRenameChange={setRenameValue}
            onSaveRename={() => saveRename(section.id)}
            onCancelRename={() => setRenamingId(null)}
            onRequestDelete={() => setConfirmDeleteId(section.id)}
          />
        ))}
      </Reorder.Group>
      {order.length === 0 && <p className="dashboard-empty">No sections yet. Codes will show under "Other" until you add one.</p>}
      {adding ? (
        <div className="iscode-add-form">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. IS Codes, NBC, IRC" />
          <div className="resource-item-actions">
            <button className="action-btn approve-btn" disabled={!newName.trim()} onClick={addSection}>Add</button>
            <button className="action-btn reject-btn" onClick={() => { setAdding(false); setNewName('') }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="add-inline-btn" onClick={() => setAdding(true)}>
          <AddIcon sx={{ fontSize: 16 }} /> Add section
        </button>
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title="Delete section?"
          message="Codes in this section will move to Other, not be deleted."
          confirmLabel="Delete section"
          onConfirm={() => deleteSection(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}

const SectionRow = ({ section, renaming, renameValue, onStartRename, onRenameChange, onSaveRename, onCancelRename, onRequestDelete }) => {
  const dragControls = useDragControls()

  if (renaming) {
    return (
      <div className="resource-item-row editing">
        <input value={renameValue} onChange={(e) => onRenameChange(e.target.value)} placeholder="Section name" />
        <div className="resource-item-actions">
          <button className="action-btn approve-btn" disabled={!renameValue.trim()} onClick={onSaveRename}>Save</button>
          <button className="action-btn reject-btn" onClick={onCancelRename}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <Reorder.Item as="div" value={section} dragListener={false} dragControls={dragControls} className="resource-item-row" whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', zIndex: 5 }}>
      <span className="drag-handle" onPointerDown={(e) => dragControls.start(e)} title="Drag to reorder">
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </span>
      <div className="resource-item-text">
        <span className="resource-item-name">{section.name}</span>
      </div>
      <div className="resource-item-actions">
        <button className="icon-btn" onClick={onStartRename} aria-label="Rename"><EditIcon sx={{ fontSize: 18 }} /></button>
        <button className="icon-btn danger" onClick={onRequestDelete} aria-label="Delete"><DeleteIcon sx={{ fontSize: 18 }} /></button>
      </div>
    </Reorder.Item>
  )
}

const SectionSelect = ({ sections, value, onChange }) => (
  <Select
    value={value || ''}
    onChange={(v) => onChange(v || null)}
    options={[{ value: '', label: 'No section (Other)' }, ...sections.map((s) => ({ value: s.id, label: s.name }))]}
    placeholder="No section (Other)"
  />
)

const CodeRow = ({ item, sections, onChanged, onOpen }) => {
  const { profile } = useAuth()
  const canCompress = !!profile
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description || '')
  const [path, setPath] = useState(item.path)
  const [sectionId, setSectionId] = useState(item.section_id || null)
  const [fileSize, setFileSize] = useState(item.file_size_bytes || null)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingOriginalFile, setPendingOriginalFile] = useState(null)
  const [pendingCompressedFile, setPendingCompressedFile] = useState(null)
  const [showCompress, setShowCompress] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [confirmTrash, setConfirmTrash] = useState(false)
  const dragControls = useDragControls()

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploadError('')
    setPendingFile(file)
    setPendingOriginalFile(file)
    setPendingCompressedFile(null)
  }

  const previewPendingFile = () => {
    if (!pendingFile) return
    onOpen({ name: pendingFile.name, path: URL.createObjectURL(pendingFile) })
  }

  const uploadPendingFile = async () => {
    setUploading(true)
    setUploadError('')
    try {
      const sectionName = sections.find((s) => s.id === sectionId)?.name
      const url = await uploadCodeFile(pendingFile, name || item.name, sectionName)
      setPath(url)
      setFileSize(pendingFile.size)
      setPendingFile(null)
      setPendingOriginalFile(null)
      setPendingCompressedFile(null)
    } catch (err) {
      setUploadError(err.message)
    }
    setUploading(false)
  }

  const save = async () => {
    setSaving(true)
    setUploadError('')
    const { error } = await supabase.from('resources').update({ name, description: description.trim() || null, path, file_size_bytes: fileSize, section_id: sectionId, updated_at: new Date().toISOString() }).eq('id', item.id)
    setSaving(false)
    if (error) {
      setUploadError(error.message)
      return
    }
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    setConfirmTrash(false)
    await supabase.from('resources').update({ deleted_at: new Date().toISOString() }).eq('id', item.id)
    onChanged()
  }

  if (editing) {
    return (
      <div className="resource-item-row editing">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IS 456:2000" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Title, e.g. Plain and Reinforced Concrete - Code of Practice" className="iscode-description-input" />
        <SectionSelect sections={sections} value={sectionId} onChange={setSectionId} />
        <div className="file-upload-field">
          <label className="file-upload-btn">
            {uploading ? 'Uploading…' : 'Replace file'}
            <input type="file" accept="application/pdf" onChange={handleFileSelect} disabled={uploading} hidden />
          </label>
          {pendingFile ? (
            <span className="resource-item-path">{pendingFile.name}</span>
          ) : (
            <span className="resource-item-path">{path}</span>
          )}
          {pendingFile && (
            <div className="pending-file-actions">
              <button type="button" className="icon-btn" onClick={previewPendingFile} aria-label="Preview PDF" title="Preview PDF">
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </button>
              {canCompress && (
                <button type="button" className="icon-btn" onClick={() => setShowCompress(true)} aria-label="Compress PDF" title="Compress PDF">
                  <CompressIcon sx={{ fontSize: 16 }} />
                </button>
              )}
              <button type="button" className="action-btn approve-btn" disabled={uploading} onClick={uploadPendingFile}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" className="action-btn reject-btn" disabled={uploading} onClick={() => { setPendingFile(null); setPendingOriginalFile(null); setPendingCompressedFile(null) }}>Discard</button>
            </div>
          )}
        </div>
        {uploadError && <span className="dashboard-error">{uploadError}</span>}
        <div className="resource-item-actions">
          <button className="action-btn approve-btn" disabled={saving || uploading || !!pendingFile} onClick={save}>Save</button>
          <button className="action-btn reject-btn" onClick={() => setEditing(false)}>Cancel</button>
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

  return (
    <Reorder.Item as="div" value={item} dragListener={false} dragControls={dragControls} className="resource-item-row" whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', zIndex: 5 }}>
      <span className="drag-handle" onPointerDown={(e) => dragControls.start(e)} title="Drag to reorder">
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </span>
      <div className="resource-item-text">
        <span className="resource-item-name">{item.name}</span>
        {item.description && <span className="iscode-description-preview">{item.description}</span>}
        <span className="resource-item-path">{sections.find((s) => s.id === item.section_id)?.name || 'Other'} · {item.path}</span>
      </div>
      {item.file_size_bytes ? <span className="resource-item-size">{formatBytes(item.file_size_bytes)}</span> : null}
      <div className="resource-item-actions">
        <button className="icon-btn" onClick={() => onOpen({ name: item.name, path: item.path, resourceId: item.id })} aria-label="Open"><OpenInNewIcon sx={{ fontSize: 18 }} /></button>
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit"><EditIcon sx={{ fontSize: 18 }} /></button>
        <button className="icon-btn danger" onClick={() => setConfirmTrash(true)} aria-label="Trash"><DeleteIcon sx={{ fontSize: 18 }} /></button>
      </div>
      {confirmTrash && (
        <ConfirmModal
          title="Move to trash?"
          message={`"${item.name}" will move to Trash and can be restored within 30 days.`}
          confirmLabel="Move to trash"
          onConfirm={remove}
          onCancel={() => setConfirmTrash(false)}
        />
      )}
    </Reorder.Item>
  )
}

const AddCodeForm = ({ sections, onAdded, onOpen }) => {
  const { profile } = useAuth()
  const canCompress = !!profile
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sectionId, setSectionId] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingOriginalFile, setPendingOriginalFile] = useState(null)
  const [pendingCompressedFile, setPendingCompressedFile] = useState(null)
  const [showCompress, setShowCompress] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploadError('')
    setPendingFile(file)
    setPendingOriginalFile(file)
    setPendingCompressedFile(null)
  }

  const previewPendingFile = () => {
    if (!pendingFile) return
    onOpen({ name: pendingFile.name, path: URL.createObjectURL(pendingFile) })
  }

  const add = async () => {
    if (!name.trim() || !pendingFile) return
    setSaving(true)
    setUploadError('')
    try {
      const sectionName = sections.find((s) => s.id === sectionId)?.name
      const url = await uploadCodeFile(pendingFile, name.trim(), sectionName)
      await insertCodeOnTop({ name: name.trim(), path: url, file_size_bytes: pendingFile.size, section_id: sectionId, description: description.trim() })
      setOpen(false)
      setName('')
      setDescription('')
      setSectionId(null)
      setPendingFile(null)
      setPendingOriginalFile(null)
      setPendingCompressedFile(null)
      onAdded()
    } catch (err) {
      setUploadError(err.message || 'Could not add this code.')
    }
    setSaving(false)
  }

  if (!open) {
    return (
      <button className="add-inline-btn codes-add-code-btn" onClick={() => setOpen(true)}>
        <AddIcon sx={{ fontSize: 16 }} /> Add code
      </button>
    )
  }

  return (
    <div className="iscode-add-form">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IS 456:2000" disabled={saving} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Title (optional), e.g. Plain and Reinforced Concrete - Code of Practice" disabled={saving} className="iscode-description-input" />
      <SectionSelect sections={sections} value={sectionId} onChange={setSectionId} />
      <div className="iscode-add-file-row">
        <label className="file-upload-btn">
          {pendingFile ? 'Choose different PDF' : 'Choose PDF'}
          <input type="file" accept="application/pdf" onChange={handleFileSelect} disabled={saving} hidden />
        </label>
        <span className="resource-item-path">{pendingFile ? pendingFile.name : 'No file chosen'}</span>
        <div className="iscode-add-file-actions">
          <button type="button" className="icon-btn" onClick={previewPendingFile} disabled={!pendingFile} aria-label="Preview PDF" title="Preview PDF">
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </button>
          {canCompress && (
            <button type="button" className="icon-btn" onClick={() => setShowCompress(true)} disabled={!pendingFile} aria-label="Compress PDF" title="Compress PDF">
              <CompressIcon sx={{ fontSize: 16 }} />
            </button>
          )}
        </div>
      </div>
      {uploadError && <span className="dashboard-error">{uploadError}</span>}
      <div className="resource-item-actions">
        <button className="action-btn approve-btn" disabled={saving || !name.trim() || !pendingFile} onClick={add}>
          {saving ? 'Adding…' : 'Add code'}
        </button>
        <button className="action-btn reject-btn" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
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

const CodeGroup = ({ title, items, sections, onChanged, onOpen }) => {
  const [order, setOrder] = useState(items)
  const [dirty, setDirty] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [syncedIds, setSyncedIds] = useState(items.map((i) => i.id).join(','))

  const freshIds = items.map((i) => i.id).join(',')
  if (!dirty && freshIds !== syncedIds) {
    setOrder(items)
    setSyncedIds(freshIds)
  }

  const handleReorder = (newOrder) => {
    setOrder(newOrder)
    setDirty(true)
  }

  const confirmOrder = async () => {
    setCommitting(true)
    await persistOrder('resources', order)
    setCommitting(false)
    setDirty(false)
    onChanged()
  }

  const cancelOrder = () => {
    setOrder(items)
    setDirty(false)
  }

  return (
    <div className="iscode-section-group">
      <div className="iscode-section-group-header">
        <span className="iscode-section-group-title">{title}</span>
        <span className="subject-panel-count">{items.length} code{items.length === 1 ? '' : 's'}</span>
      </div>
      {dirty && (
        <div className="reorder-confirm-bar">
          <span>Order changed</span>
          <button className="icon-btn success" onClick={confirmOrder} disabled={committing} aria-label="Confirm order"><CheckIcon sx={{ fontSize: 18 }} /></button>
          <button className="icon-btn danger" onClick={cancelOrder} disabled={committing} aria-label="Cancel"><CloseIcon sx={{ fontSize: 18 }} /></button>
        </div>
      )}
      <Reorder.Group as="div" axis="y" values={order} onReorder={handleReorder} className="draggable-list">
        {order.map((item) => (
          <CodeRow key={item.id} item={item} sections={sections} onChanged={onChanged} onOpen={onOpen} />
        ))}
      </Reorder.Group>
      {order.length === 0 && <p className="dashboard-empty">No codes in this section yet.</p>}
    </div>
  )
}

const CodesAndStandardsPanel = ({ onOpen }) => {
  const { isCodes, sections, refresh } = useResourcesData()

  const uncategorized = isCodes.filter((item) => !item.section_id || !sections.some((s) => s.id === item.section_id))

  return (
    <>
      <SectionsManager sections={sections} onChanged={refresh} />
      <div className="resource-group">
        <h4>Codes & Standards</h4>
        <AddCodeForm sections={sections} onAdded={refresh} onOpen={onOpen} />
        {sections.map((section) => (
          <CodeGroup
            key={section.id}
            title={section.name}
            items={isCodes.filter((item) => item.section_id === section.id)}
            sections={sections}
            onChanged={refresh}
            onOpen={onOpen}
          />
        ))}
        <CodeGroup
          title={sections.length > 0 ? 'Other' : 'All codes'}
          items={uncategorized}
          sections={sections}
          onChanged={refresh}
          onOpen={onOpen}
        />
        {isCodes.length === 0 && <p className="dashboard-empty">No codes added yet.</p>}
      </div>
    </>
  )
}

export default CodesAndStandardsPanel
