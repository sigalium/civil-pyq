import { useEffect, useRef, useState } from 'react'
import { Reorder, useDragControls, motion as Motion, AnimatePresence } from 'framer-motion'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { FileUp } from 'lucide-react'
import { useResourcesData } from '../../context/useResourcesData'
import { usePDFWindows } from '../../context/usePDFWindows'
import { useNotifications } from '../../context/useNotifications'
import { supabase } from '../../lib/supabaseClient'
import { uploadFileToGithub } from '../../utils/githubUpload'
import { recordReplacedFile } from '../../utils/replacedFiles'
import { persistOrder, insertResourceOnTop } from '../../utils/resourceOrdering'
import { formatBytes } from '../../utils/pdfCompression'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BackButton from '../../components/BackButton'
import { useNavigate, useParams } from 'react-router-dom'
import CodesAndStandardsPanel from './CodesAndStandardsPanel'
import ConfirmModal from '../../components/ConfirmModal'
import PositionInput from '../../components/PositionInput'
import ResourceFileForm from '../../components/ResourceFileForm'
import './Dashboard.css'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const TYPE_LABELS = { pyq: 'Previous Year Questions', lab: 'Lab Manuals & Other Resources' }

function isSameOrder(a, b) {
  if (a.length !== b.length) return false
  return a.every((entry, i) => entry.id === b[i].id)
}

const ResourceItemRow = ({ item, semester, subject, type, onChanged, onOpen, draggable, position, total, onMove, onDragEnd }) => {
  const [editing, setEditing] = useState(false)
  const [confirmTrash, setConfirmTrash] = useState(false)
  const dragControls = useDragControls()
  const { notify } = useNotifications()

  const remove = async () => {
    setConfirmTrash(false)
    await supabase.from('resources').update({ deleted_at: new Date().toISOString() }).eq('id', item.id)
    onChanged()
    notify({
      variant: 'success',
      message: `"${item.name}" was moved to trash.`,
      actionLabel: 'Undo',
      onAction: async () => {
        const { error } = await supabase.from('resources').update({ deleted_at: null }).eq('id', item.id)
        if (error) {
          notify({ variant: 'error', message: `Could not undo: ${error.message}` })
          return
        }
        onChanged()
      },
    })
  }

  if (editing) {
    return (
      <ResourceFileForm
        mode="edit"
        semester={semester}
        subject={subject}
        type={type}
        namePlaceholder="Name"
        initialName={item.name}
        initialPath={item.path}
        initialSize={item.file_size_bytes}
        onOpenPreview={onOpen}
        onCancel={() => setEditing(false)}
        onSubmit={async ({ name, path, fileSize, fileChanged }) => {
          if (fileChanged && item.path && path !== item.path) {
            await recordReplacedFile({ oldUrl: item.path, resourceName: name, resourceType: type, fileSizeBytes: item.file_size_bytes })
          }
          await supabase.from('resources').update({ name, path, file_size_bytes: fileSize, updated_at: new Date().toISOString() }).eq('id', item.id)
          setEditing(false)
          onChanged()
        }}
      />
    )
  }

  const content = (
    <>
      {draggable ? (
        <span
          className="drag-handle"
          onPointerDown={(e) => dragControls.start(e)}
          title="Drag to reorder"
        >
          <DragIndicatorIcon sx={{ fontSize: 18 }} />
        </span>
      ) : (
        <span className="drag-handle drag-handle-disabled">
          <DragIndicatorIcon sx={{ fontSize: 18 }} />
        </span>
      )}
      {draggable && typeof position === 'number' && total > 1 && (
        <PositionInput position={position} total={total} onMove={(newPosition) => onMove(item.id, newPosition)} />
      )}
      <div className="resource-item-text">
        <span className="resource-item-name">
          {item.name}
          {item.linked_iscode_id && <span className="iscode-linked-badge">Code</span>}
        </span>
        {item.description && <span className="iscode-description-preview">{item.description}</span>}
        <span className="resource-item-path">{item.path}</span>
      </div>
      {item.file_size_bytes ? <span className="resource-item-size">{formatBytes(item.file_size_bytes)}</span> : null}
      <div className="resource-item-actions">
        {item.linked_iscode_id ? (
          <>
            <button className="icon-btn" onClick={() => onOpen(item)} aria-label="Review"><OpenInNewIcon sx={{ fontSize: 18 }} /></button>
            <button className="icon-btn danger" onClick={() => setConfirmTrash(true)} aria-label="Delink"><LinkOffIcon sx={{ fontSize: 18 }} /></button>
          </>
        ) : (
          <>
            <button className="icon-btn" onClick={() => onOpen(item)} aria-label="Open"><OpenInNewIcon sx={{ fontSize: 18 }} /></button>
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit"><EditIcon sx={{ fontSize: 18 }} /></button>
            <button className="icon-btn danger" onClick={() => setConfirmTrash(true)} aria-label="Delete"><DeleteIcon sx={{ fontSize: 18 }} /></button>
          </>
        )}
      </div>
      {confirmTrash && (
        <ConfirmModal
          title={item.linked_iscode_id ? 'Delink this code?' : 'Move to trash?'}
          message={
            item.linked_iscode_id
              ? `"${item.name}" will be removed from this subject. The file itself will stay in Codes & Standards.`
              : `"${item.name}" will move to Trash and can be restored within 30 days.`
          }
          confirmLabel={item.linked_iscode_id ? 'Delink' : 'Move to trash'}
          onConfirm={remove}
          onCancel={() => setConfirmTrash(false)}
        />
      )}
    </>
  )

  if (!draggable) {
    return <div className="resource-item-row">{content}</div>
  }

  return (
    <Reorder.Item
      as="div"
      value={item}
      dragListener={false}
      dragControls={dragControls}
      className="resource-item-row"
      layout="position"
      whileDrag={{ boxShadow: '0 12px 30px rgba(0,0,0,0.35)', zIndex: 5 }}
      onDragEnd={onDragEnd}
    >
      {content}
    </Reorder.Item>
  )
}

const ReorderConfirmBar = ({ onConfirm, onCancel, busy }) => (
  <div className="reorder-confirm-bar">
    <span>Order changed</span>
    <button className="icon-btn success" onClick={onConfirm} disabled={busy} aria-label="Confirm order">
      <CheckIcon sx={{ fontSize: 18 }} />
    </button>
    <button className="icon-btn danger" onClick={onCancel} disabled={busy} aria-label="Cancel">
      <CloseIcon sx={{ fontSize: 18 }} />
    </button>
  </div>
)

const RESOURCE_PAGE_SIZE = 5

const DraggableResourceList = ({ items, semester, subject, type, onChanged, onOpen }) => {
  const [order, setOrder] = useState(items)
  const [page, setPage] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [committing, setCommitting] = useState(false)
  const orderRef = useRef(items)

  useEffect(() => {
    setOrder(items)
    orderRef.current = items
    setPage(0)
    setDirty(false)
  }, [items])

  const totalPages = Math.max(1, Math.ceil(order.length / RESOURCE_PAGE_SIZE))
  const pageItems = order.slice(page * RESOURCE_PAGE_SIZE, page * RESOURCE_PAGE_SIZE + RESOURCE_PAGE_SIZE)

  const handleReorder = (newPageOrder) => {
    const newFullOrder = [...orderRef.current]
    newFullOrder.splice(page * RESOURCE_PAGE_SIZE, pageItems.length, ...newPageOrder)
    orderRef.current = newFullOrder
    setOrder(newFullOrder)
  }

  const handleDragEnd = () => {
    setDirty(!isSameOrder(orderRef.current, items))
  }

  const reorderByPosition = (id, newPosition) => {
    const currentIndex = order.findIndex((entry) => entry.id === id)
    if (currentIndex === -1) return
    const targetIndex = Math.min(Math.max(newPosition - 1, 0), order.length - 1)
    if (targetIndex === currentIndex) return
    const newFullOrder = [...order]
    const [moved] = newFullOrder.splice(currentIndex, 1)
    newFullOrder.splice(targetIndex, 0, moved)
    orderRef.current = newFullOrder
    setOrder(newFullOrder)
    setDirty(!isSameOrder(newFullOrder, items))
    setPage(Math.floor(targetIndex / RESOURCE_PAGE_SIZE))
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
    <>
      {dirty && <ReorderConfirmBar onConfirm={confirmOrder} onCancel={cancelOrder} busy={committing} />}
      <Reorder.Group as="div" axis="y" values={pageItems} onReorder={handleReorder} className="draggable-list">
        {pageItems.map((item) => (
          <ResourceItemRow
            key={item.id}
            item={item}
            semester={semester}
            subject={subject}
            type={type}
            onChanged={onChanged}
            onOpen={onOpen}
            draggable
            position={order.findIndex((entry) => entry.id === item.id) + 1}
            total={order.length}
            onMove={reorderByPosition}
            onDragEnd={handleDragEnd}
          />
        ))}
      </Reorder.Group>
      {order.length > RESOURCE_PAGE_SIZE && (
        <div className="pagination-bar">
          <button className="action-btn reject-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </button>
          <span className="pagination-status">Page {page + 1} of {totalPages}</span>
          <button className="action-btn reject-btn" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </>
  )
}

const AddResourceForm = ({ semester, subject, type, onAdded, onOpen, open, onOpenChange }) => {
  if (!open) {
    return (
      <button className="add-inline-btn" onClick={() => onOpenChange(true)}>
        <AddIcon sx={{ fontSize: 16 }} /> Add {type === 'syllabus' ? 'syllabus' : type}
      </button>
    )
  }

  return (
    <ResourceFileForm
      mode="add"
      semester={semester}
      subject={subject}
      type={type}
      namePlaceholder="Name (e.g. ESE Dec 2025)"
      onOpenPreview={onOpen}
      onCancel={() => onOpenChange(false)}
      onSubmit={async ({ name, path, fileSize }) => {
        if (type === 'syllabus') {
          await supabase.from('resources').update({ deleted_at: new Date().toISOString() }).eq('subject', subject).eq('semester', semester).eq('resource_type', 'syllabus').is('deleted_at', null)
          await supabase.from('resources').insert({
            semester,
            subject,
            resource_type: type,
            name,
            path,
            file_size_bytes: fileSize,
          })
        } else {
          await insertResourceOnTop({
            semester,
            subject,
            resource_type: type,
            name,
            path,
            file_size_bytes: fileSize,
          })
        }
        onOpenChange(false)
        onAdded()
      }}
    />
  )
}

const SubjectPanel = ({ subjectRow, entry, onChanged, onOpen, draggable, onDragEnd }) => {
  const [expanded, setExpanded] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(subjectRow.name)
  const [confirmSubjectTrash, setConfirmSubjectTrash] = useState(false)
  const [syllabusFormOpen, setSyllabusFormOpen] = useState(false)
  const [sectionFormOpen, setSectionFormOpen] = useState({ pyq: false, lab: false })
  const dragControls = useDragControls()
  const { notify } = useNotifications()

  const rename = async () => {
    if (!name.trim() || name.trim() === subjectRow.name) {
      setRenaming(false)
      return
    }
    await supabase.from('subjects').update({ name: name.trim() }).eq('id', subjectRow.id)
    await supabase
      .from('resources')
      .update({ subject: name.trim() })
      .eq('subject', subjectRow.name)
      .eq('semester', subjectRow.semester)
    setRenaming(false)
    onChanged()
  }

  const toggleElective = async () => {
    await supabase.from('subjects').update({ is_elective: !subjectRow.is_elective }).eq('id', subjectRow.id)
    onChanged()
  }

  const removeSubject = async () => {
    setConfirmSubjectTrash(false)
    const now = new Date().toISOString()
    await supabase.from('resources').update({ deleted_at: now }).eq('subject', subjectRow.name).eq('semester', subjectRow.semester).is('deleted_at', null)
    await supabase.from('subjects').update({ deleted_at: now }).eq('id', subjectRow.id)
    onChanged()
    notify({
      variant: 'success',
      message: `"${subjectRow.name}" was moved to trash.`,
      actionLabel: 'Undo',
      onAction: async () => {
        const { error: subjectError } = await supabase.from('subjects').update({ deleted_at: null }).eq('id', subjectRow.id)
        const { error: resourcesError } = await supabase.from('resources').update({ deleted_at: null }).eq('subject', subjectRow.name).eq('semester', subjectRow.semester).eq('deleted_at', now)
        const firstError = subjectError || resourcesError
        if (firstError) {
          notify({ variant: 'error', message: `Could not fully undo: ${firstError.message}` })
          return
        }
        onChanged()
      },
    })
  }

  const pyq = entry?.pyq || []
  const lab = entry?.lab || []
  const syllabus = entry?.syllabus || null
  const usingCentralSyllabus = entry?.isCentralSyllabus || false

  const content = (
    <>
      <div className="subject-panel-header" onClick={() => setExpanded(!expanded)}>
        {draggable ? (
          <span
            className="drag-handle"
            onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e) }}
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <DragIndicatorIcon sx={{ fontSize: 18 }} />
          </span>
        ) : (
          <span className="drag-handle drag-handle-disabled">
            <DragIndicatorIcon sx={{ fontSize: 18 }} />
          </span>
        )}
        <ExpandMoreIcon
          sx={{ fontSize: 20, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        />
        {renaming ? (
          <input
            className="subject-rename-input"
            value={name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === 'Enter' && rename()}
            autoFocus
          />
        ) : (
          <span className="subject-panel-name">{subjectRow.name}</span>
        )}
        {subjectRow.is_elective && <span className="elective-chip">Elective</span>}
        <div className="subject-panel-meta">
          <span className="subject-panel-count">{pyq.length + lab.length + (syllabus ? 1 : 0)} files</span>
          <div className="subject-panel-actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" onClick={() => setRenaming(true)} aria-label="Rename"><EditIcon sx={{ fontSize: 16 }} /></button>
            <button className="icon-btn danger" onClick={() => setConfirmSubjectTrash(true)} aria-label="Delete subject"><DeleteIcon sx={{ fontSize: 16 }} /></button>
          </div>
        </div>
      </div>

      {confirmSubjectTrash && (
        <ConfirmModal
          title="Move subject to trash?"
          message={`"${subjectRow.name}" and all its files will move to Trash and can be restored within 30 days.`}
          confirmLabel="Move to trash"
          onConfirm={removeSubject}
          onCancel={() => setConfirmSubjectTrash(false)}
        />
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <Motion.div
            className="subject-panel-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
          <div className="subject-panel-body-inner">
            <label className="toggle-switch-field elective-toggle-row" onClick={(e) => e.stopPropagation()}>
              <span>Elective subject</span>
              <span className={`toggle-switch ${subjectRow.is_elective ? 'on' : ''}`} onClick={toggleElective}>
                <span className="toggle-switch-knob" />
              </span>
            </label>
          </div>
          <div className="resource-group">
            <h4>Syllabus</h4>
            {syllabus && (
              <ResourceItemRow
                item={{ id: syllabus.id, name: 'Syllabus', path: syllabus.path }}
                semester={subjectRow.semester}
                subject={subjectRow.name}
                type="syllabus"
                onChanged={onChanged}
                onOpen={onOpen}
              />
            )}
            {!syllabus && usingCentralSyllabus && (
              <p className="snippet-hint">Using the Semester {subjectRow.semester} central syllabus. Upload one here to override it just for this subject.</p>
            )}
            {!syllabus && (
              <AddResourceForm
                semester={subjectRow.semester}
                subject={subjectRow.name}
                type="syllabus"
                onAdded={onChanged}
                onOpen={onOpen}
                open={syllabusFormOpen}
                onOpenChange={setSyllabusFormOpen}
              />
            )}
          </div>

          {['pyq', 'lab'].map((type) => (
            <div className="resource-group" key={type}>
              <h4>{TYPE_LABELS[type]}</h4>
              <DraggableResourceList
                items={type === 'pyq' ? pyq : lab}
                semester={subjectRow.semester}
                subject={subjectRow.name}
                type={type}
                onChanged={onChanged}
                onOpen={onOpen}
              />
              <div className="subject-section-actions">
                <AddResourceForm
                  semester={subjectRow.semester}
                  subject={subjectRow.name}
                  type={type}
                  onAdded={onChanged}
                  onOpen={onOpen}
                  open={sectionFormOpen[type]}
                  onOpenChange={(value) => setSectionFormOpen((prev) => ({ ...prev, [type]: value }))}
                />
                {type === 'lab' && !sectionFormOpen.lab && (
                  <LinkIsCodeButton semester={subjectRow.semester} subject={subjectRow.name} type={type} onLinked={onChanged} />
                )}
              </div>
            </div>
          ))}
          </Motion.div>
        )}
      </AnimatePresence>
    </>
  )

  if (!draggable) {
    return <div className="subject-panel">{content}</div>
  }

  return (
    <Reorder.Item
      as="div"
      value={subjectRow}
      dragListener={false}
      dragControls={dragControls}
      className="subject-panel"
      layout="position"
      whileDrag={{ boxShadow: '0 20px 45px rgba(0,0,0,0.4)', zIndex: 5 }}
      onDragEnd={onDragEnd}
    >
      {content}
    </Reorder.Item>
  )
}

const AddSubjectForm = ({ semester, sortOrder, onAdded }) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [isElective, setIsElective] = useState(false)
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('subjects').insert({
      semester,
      name: name.trim(),
      is_elective: isElective,
      sort_order: sortOrder,
    })
    setSaving(false)
    setOpen(false)
    setName('')
    setIsElective(false)
    onAdded()
  }

  if (!open) {
    return (
      <button className="add-inline-btn" onClick={() => setOpen(true)}>
        <AddIcon sx={{ fontSize: 16 }} /> Add subject
      </button>
    )
  }

  return (
    <div className="resource-item-row editing">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Subject name" autoFocus />
      <label className="toggle-switch-field elective-toggle-row" onClick={(e) => e.stopPropagation()}>
        <span>Elective</span>
        <span className={`toggle-switch ${isElective ? 'on' : ''}`} onClick={() => setIsElective(!isElective)}>
          <span className="toggle-switch-knob" />
        </span>
      </label>
      <div className="resource-item-actions">
        <button className="action-btn approve-btn" disabled={saving} onClick={add}>Add</button>
        <button className="action-btn reject-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

const CALENDAR_REPO_PATH = 'pdfs/Academic_Calendar.pdf'

const LinkIsCodeButton = ({ semester, subject, type, onLinked }) => {
  const { isCodes } = useResourcesData()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [linking, setLinking] = useState(false)

  const filtered = isCodes.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))

  const link = async (code) => {
    setLinking(true)
    const newId = await insertResourceOnTop({
      semester,
      subject,
      resource_type: type,
      name: code.name,
      path: code.path,
      file_size_bytes: code.file_size_bytes,
    })
    await supabase.from('resources').update({ linked_iscode_id: code.id }).eq('id', newId)
    setLinking(false)
    setOpen(false)
    setQuery('')
    onLinked()
  }

  if (!open) {
    return (
      <button className="add-inline-btn" onClick={() => setOpen(true)}>
        <MenuBookIcon sx={{ fontSize: 16 }} /> Link a code
      </button>
    )
  }

  return (
    <div className="pdf-compress-overlay" onClick={() => !linking && setOpen(false)}>
      <div className="link-iscode-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-compress-header">
          <span className="pdf-compress-title">Link a code</span>
          <button className="icon-btn" onClick={() => setOpen(false)} disabled={linking} aria-label="Close">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
        <input
          type="text"
          className="member-username-input"
          placeholder="Search codes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="link-iscode-list">
          {filtered.length === 0 && <p className="dashboard-empty">No codes found. Add some from "Manage Codes & Standards" above first.</p>}
          {filtered.map((code) => (
            <button key={code.id} className="link-iscode-option" disabled={linking} onClick={() => link(code)}>
              <span className="link-iscode-option-name">{code.name}</span>
              {code.description && <span className="iscode-description-preview">{code.description}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const AcademicCalendarPanel = ({ path, onOpen, onChanged }) => {
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [pendingReplaceFile, setPendingReplaceFile] = useState(null)
  const { notify } = useNotifications()

  const uploadFile = async (file) => {
    setSaving(true)
    setUploadError('')
    try {
      const url = await uploadFileToGithub({
        file,
        repoPath: CALENDAR_REPO_PATH,
        commitMessage: 'Update academic calendar',
      })
      await supabase.from('global_resources').upsert({ key: 'academic_calendar_path', value: url, updated_at: new Date().toISOString() })
      onChanged()
    } catch (err) {
      setUploadError(err.message)
    }
    setSaving(false)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (path) {
      setPendingReplaceFile(file)
    } else {
      uploadFile(file)
    }
  }

  const confirmReplace = () => {
    const file = pendingReplaceFile
    setPendingReplaceFile(null)
    uploadFile(file)
  }

  const remove = async () => {
    setConfirmRemove(false)
    const oldPath = path
    setSaving(true)
    await supabase.from('global_resources').upsert({ key: 'academic_calendar_path', value: '', updated_at: new Date().toISOString() })
    setSaving(false)
    onChanged()
    notify({
      variant: 'success',
      message: 'Academic Calendar removed.',
      actionLabel: 'Undo',
      onAction: async () => {
        const { error } = await supabase.from('global_resources').upsert({ key: 'academic_calendar_path', value: oldPath, updated_at: new Date().toISOString() })
        if (error) {
          notify({ variant: 'error', message: `Could not undo: ${error.message}` })
          return
        }
        onChanged()
      },
    })
  }

  return (
    <div className="subject-panel academic-calendar-loaded">
      <div className="subject-panel-header" style={{ cursor: 'default' }}>
        <span className="subject-panel-name">Academic Calendar</span>
        <span className="subject-panel-count">{path ? 'Set' : 'Not set'}</span>
      </div>
      <div className="subject-panel-body" style={{ borderTop: '1px solid rgba(var(--glass-rgb), 0.1)' }}>
        <div className="resource-item-row">
          <div className="resource-item-text">
            <span className="resource-item-name">{path ? 'Academic_Calendar.pdf' : 'No calendar set'}</span>
            {path && <span className="resource-item-path">{path}</span>}
          </div>
          <div className="resource-item-actions">
            {path && (
              <button className="icon-btn" onClick={() => onOpen({ name: 'Academic Calendar', path })} aria-label="Open">
                <OpenInNewIcon sx={{ fontSize: 18 }} />
              </button>
            )}
            <label className="icon-btn" aria-label="Upload">
              {saving ? '…' : <FileUp size={18} />}
              <input type="file" accept="application/pdf" onChange={handleFileSelect} disabled={saving} hidden />
            </label>
            {path && (
              <button className="icon-btn danger" onClick={() => setConfirmRemove(true)} aria-label="Remove"><DeleteIcon sx={{ fontSize: 18 }} /></button>
            )}
          </div>
        </div>
        {uploadError && <p className="dashboard-error">{uploadError}</p>}
      </div>
      {confirmRemove && (
        <ConfirmModal
          title="Remove Academic Calendar?"
          message="The button on the site will have nothing to open until a new one is uploaded."
          confirmLabel="Remove"
          onConfirm={remove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {pendingReplaceFile && (
        <ConfirmModal
          title="Replace Academic Calendar?"
          message="This will replace the current Academic Calendar PDF for everyone."
          confirmLabel="Replace"
          danger={false}
          onConfirm={confirmReplace}
          onCancel={() => setPendingReplaceFile(null)}
        />
      )}
    </div>
  )
}

const CentralSyllabusPanel = ({ semester, centralSyllabus, onOpen, onChanged }) => {
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [pendingReplaceFile, setPendingReplaceFile] = useState(null)
  const { notify } = useNotifications()
  const path = centralSyllabus[semester] || ''
  const settingKey = `syllabus_semester_${semester}`
  const repoPath = `pdfs/Semester${semester}/Syllabus.pdf`

  const uploadFile = async (file) => {
    setSaving(true)
    setUploadError('')
    try {
      const url = await uploadFileToGithub({
        file,
        repoPath,
        commitMessage: `Update central syllabus for Semester ${semester}`,
      })
      await supabase.from('global_resources').upsert({ key: settingKey, value: url, updated_at: new Date().toISOString() })
      onChanged()
    } catch (err) {
      setUploadError(err.message)
    }
    setSaving(false)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (path) {
      setPendingReplaceFile(file)
    } else {
      uploadFile(file)
    }
  }

  const confirmReplace = () => {
    const file = pendingReplaceFile
    setPendingReplaceFile(null)
    uploadFile(file)
  }

  const remove = async () => {
    setConfirmRemove(false)
    const oldPath = path
    setSaving(true)
    await supabase.from('global_resources').upsert({ key: settingKey, value: '', updated_at: new Date().toISOString() })
    setSaving(false)
    onChanged()
    notify({
      variant: 'success',
      message: `Semester ${semester} central syllabus removed.`,
      actionLabel: 'Undo',
      onAction: async () => {
        const { error } = await supabase.from('global_resources').upsert({ key: settingKey, value: oldPath, updated_at: new Date().toISOString() })
        if (error) {
          notify({ variant: 'error', message: `Could not undo: ${error.message}` })
          return
        }
        onChanged()
      },
    })
  }

  return (
    <div className="subject-panel">
      <div className="subject-panel-header" style={{ cursor: 'default' }}>
        <span className="subject-panel-name">Central Syllabus, Semester {semester}</span>
        <span className="subject-panel-count">{path ? 'Set' : 'Not set'}</span>
      </div>
      <div className="subject-panel-body" style={{ borderTop: '1px solid rgba(var(--glass-rgb), 0.1)' }}>
        <p className="snippet-hint">
          Used by every subject in Semester {semester} that doesn't have its own syllabus uploaded.
        </p>
        <div className="resource-item-row">
          <div className="resource-item-text">
            <span className="resource-item-name">{path ? 'Syllabus.pdf' : 'No central syllabus set'}</span>
            {path && <span className="resource-item-path">{path}</span>}
          </div>
          <div className="resource-item-actions">
            {path && (
              <button className="icon-btn" onClick={() => onOpen({ name: `Semester ${semester} Syllabus`, path })} aria-label="Open">
                <OpenInNewIcon sx={{ fontSize: 18 }} />
              </button>
            )}
            <label className="icon-btn" aria-label="Upload">
              {saving ? '…' : <FileUp size={18} />}
              <input type="file" accept="application/pdf" onChange={handleFileSelect} disabled={saving} hidden />
            </label>
            {path && (
              <button className="icon-btn danger" onClick={() => setConfirmRemove(true)} aria-label="Remove"><DeleteIcon sx={{ fontSize: 18 }} /></button>
            )}
          </div>
        </div>
        {uploadError && <p className="dashboard-error">{uploadError}</p>}
      </div>
      {confirmRemove && (
        <ConfirmModal
          title="Remove central syllabus?"
          message={`Subjects in Semester ${semester} without their own syllabus will show nothing.`}
          confirmLabel="Remove"
          onConfirm={remove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {pendingReplaceFile && (
        <ConfirmModal
          title="Replace central syllabus?"
          message={`This will replace the current Semester ${semester} central syllabus for everyone.`}
          confirmLabel="Replace"
          danger={false}
          onConfirm={confirmReplace}
          onCancel={() => setPendingReplaceFile(null)}
        />
      )}
    </div>
  )
}

const ResourcesTab = () => {
  const { subjectRows, resources, centralSyllabus, academicCalendarPath, loading, error, refresh } = useResourcesData()
  const { openPdf } = usePDFWindows()
  const navigate = useNavigate()
  const { subpath } = useParams()
  const [semester, setSemester] = useState(1)
  const [semesterSubjectsOrder, setSemesterSubjectsOrder] = useState([])
  const [subjectOrderDirty, setSubjectOrderDirty] = useState(false)
  const [committingSubjectOrder, setCommittingSubjectOrder] = useState(false)
  const semesterSubjectsOrderRef = useRef([])

  const semesterSubjects = subjectRows
    .filter((row) => row.semester === semester && !row.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)

  useEffect(() => {
    setSemesterSubjectsOrder(semesterSubjects)
    semesterSubjectsOrderRef.current = semesterSubjects
    setSubjectOrderDirty(false)
  }, [subjectRows, semester])

  const handleSubjectReorder = (newOrder) => {
    semesterSubjectsOrderRef.current = newOrder
    setSemesterSubjectsOrder(newOrder)
  }

  const handleSubjectDragEnd = () => {
    setSubjectOrderDirty(!isSameOrder(semesterSubjectsOrderRef.current, semesterSubjects))
  }

  const confirmSubjectOrder = async () => {
    setCommittingSubjectOrder(true)
    await persistOrder('subjects', semesterSubjectsOrder)
    setCommittingSubjectOrder(false)
    setSubjectOrderDirty(false)
    refresh()
  }

  const cancelSubjectOrder = () => {
    setSemesterSubjectsOrder(semesterSubjects)
    setSubjectOrderDirty(false)
  }

  if (subpath === 'codes-and-standards') {
    return (
      <div className="dashboard-panel">
        <BackButton onClick={() => navigate('/dashboard/resources')} text="Back to Resources" />
        <CodesAndStandardsPanel onOpen={openPdf} />
      </div>
    )
  }

  return (
    <div className="dashboard-panel">
      <AcademicCalendarPanel path={academicCalendarPath} onOpen={openPdf} onChanged={refresh} />

      <button className="manage-iscodes-btn" onClick={() => navigate('/dashboard/resources/codes-and-standards')}>
        <span className="manage-iscodes-btn-icon"><MenuBookIcon sx={{ fontSize: 18 }} /></span>
        <span className="manage-iscodes-btn-text">
          Manage Codes & Standards
          <span className="manage-iscodes-btn-subtitle">Upload and organize codes & standards, link them into subjects</span>
        </span>
        <ChevronRightIcon className="manage-iscodes-btn-arrow" sx={{ fontSize: 20 }} />
      </button>

      <div className="semester-tabs">
        {SEMESTERS.map((sem) => (
          <button
            key={sem}
            className={`semester-tab ${semester === sem ? 'active' : ''}`}
            onClick={() => setSemester(sem)}
          >
            Sem {sem}
          </button>
        ))}
      </div>

      <CentralSyllabusPanel semester={semester} centralSyllabus={centralSyllabus} onOpen={openPdf} onChanged={refresh} />

      {error && <p className="dashboard-error">{error}</p>}

      {loading ? (
        <p className="dashboard-empty">Loading...</p>
      ) : (
        <div className="subjects-manager">
          {subjectOrderDirty && (
            <ReorderConfirmBar onConfirm={confirmSubjectOrder} onCancel={cancelSubjectOrder} busy={committingSubjectOrder} />
          )}
          <Reorder.Group as="div" axis="y" values={semesterSubjectsOrder} onReorder={handleSubjectReorder} className="subject-list">
            {semesterSubjectsOrder.map((row) => (
              <SubjectPanel
                key={row.id}
                subjectRow={row}
                entry={resources[row.name]}
                onChanged={refresh}
                onOpen={openPdf}
                draggable
                onDragEnd={handleSubjectDragEnd}
              />
            ))}
          </Reorder.Group>
          {semesterSubjects.length === 0 && (
            <p className="dashboard-empty">No subjects for Semester {semester} yet.</p>
          )}
          <AddSubjectForm semester={semester} sortOrder={semesterSubjects.length} onAdded={refresh} />
        </div>
      )}
    </div>
  )
}

export default ResourcesTab