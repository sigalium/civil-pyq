import { useEffect, useState } from 'react'
import { Reorder, useDragControls, motion as Motion, AnimatePresence } from 'framer-motion'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { useResourcesData } from '../../context/ResourcesDataContext'
import { usePDFWindows } from '../../context/PDFWindowContext'
import { supabase } from '../../lib/supabaseClient'
import { buildStagingRepoPath } from '../../utils/resourceSnippet'
import { uploadFileToGithub } from '../../utils/githubUpload'
import { persistOrder, insertResourceOnTop } from '../../utils/resourceOrdering'
import './Dashboard.css'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const TYPE_LABELS = { pyq: 'Previous Year Questions', lab: 'Lab Manuals & Notes' }

async function uploadResourceFile({ file, semester, subject, type, label }) {
  const repoPath = buildStagingRepoPath({
    semester,
    subject,
    resource_type: type,
    resource_label: label || 'Untitled',
    file_path: file.name,
  })
  return uploadFileToGithub({
    file,
    repoPath,
    commitMessage: `Add ${label || type} (Sem ${semester} - ${subject})`,
  })
}

const ResourceItemRow = ({ item, semester, subject, type, onChanged, onOpen, draggable, onDragCommit }) => {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [path, setPath] = useState(item.path)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const dragControls = useDragControls()

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadResourceFile({ file, semester, subject, type, label: name })
      setPath(url)
    } catch (err) {
      setUploadError(err.message)
    }
    setUploading(false)
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('resources').update({ name, path, updated_at: new Date().toISOString() }).eq('id', item.id)
    setSaving(false)
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    if (!window.confirm(`Move "${item.name}" to trash?`)) return
    await supabase.from('resources').update({ deleted_at: new Date().toISOString() }).eq('id', item.id)
    onChanged()
  }

  if (editing) {
    return (
      <div className="resource-item-row editing">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <div className="file-upload-field">
          <label className="file-upload-btn">
            {uploading ? 'Uploading…' : 'Replace file'}
            <input type="file" accept="application/pdf" onChange={handleFileUpload} disabled={uploading} hidden />
          </label>
          <span className="resource-item-path">{path}</span>
        </div>
        {uploadError && <span className="dashboard-error">{uploadError}</span>}
        <div className="resource-item-actions">
          <button className="action-btn approve-btn" disabled={saving || uploading} onClick={save}>Save</button>
          <button className="action-btn reject-btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
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
      <div className="resource-item-text">
        <span className="resource-item-name">{item.name}</span>
        <span className="resource-item-path">{item.path}</span>
      </div>
      <div className="resource-item-actions">
        <button className="icon-btn" onClick={() => onOpen(item)} aria-label="Open"><OpenInNewIcon sx={{ fontSize: 18 }} /></button>
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit"><EditIcon sx={{ fontSize: 18 }} /></button>
        <button className="icon-btn danger" onClick={remove} aria-label="Delete"><DeleteIcon sx={{ fontSize: 18 }} /></button>
      </div>
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
      onDragEnd={onDragCommit}
      className="resource-item-row"
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', zIndex: 5 }}
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

  useEffect(() => {
    setOrder(items)
    setPage(0)
    setDirty(false)
  }, [items])

  const totalPages = Math.max(1, Math.ceil(order.length / RESOURCE_PAGE_SIZE))
  const pageItems = order.slice(page * RESOURCE_PAGE_SIZE, page * RESOURCE_PAGE_SIZE + RESOURCE_PAGE_SIZE)

  const handleReorder = (newPageOrder) => {
    const newFullOrder = [...order]
    newFullOrder.splice(page * RESOURCE_PAGE_SIZE, pageItems.length, ...newPageOrder)
    setOrder(newFullOrder)
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
    <>
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
            onDragCommit={() => setDirty(true)}
          />
        ))}
      </Reorder.Group>
      {dirty && <ReorderConfirmBar onConfirm={confirmOrder} onCancel={cancelOrder} busy={committing} />}
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

const AddResourceForm = ({ semester, subject, type, onAdded }) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadResourceFile({ file, semester, subject, type, label: name })
      setPath(url)
    } catch (err) {
      setUploadError(err.message)
    }
    setUploading(false)
  }

  const add = async () => {
    if (!name.trim() || !path.trim()) return
    setSaving(true)
    if (type === 'syllabus') {
      await supabase.from('resources').update({ deleted_at: new Date().toISOString() }).eq('subject', subject).eq('semester', semester).eq('resource_type', 'syllabus').is('deleted_at', null)
      await supabase.from('resources').insert({
        semester,
        subject,
        resource_type: type,
        name: name.trim(),
        path: path.trim(),
      })
    } else {
      await insertResourceOnTop({
        semester,
        subject,
        resource_type: type,
        name: name.trim(),
        path: path.trim(),
      })
    }
    setSaving(false)
    setOpen(false)
    setName('')
    setPath('')
    onAdded()
  }

  if (!open) {
    return (
      <button className="add-inline-btn" onClick={() => setOpen(true)}>
        <AddIcon sx={{ fontSize: 16 }} /> Add {type === 'syllabus' ? 'syllabus' : type}
      </button>
    )
  }

  return (
    <div className="resource-item-row editing">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. ESE Dec 2025)" />
      <div className="file-upload-field">
        <label className="file-upload-btn">
          {uploading ? 'Uploading…' : 'Choose PDF'}
          <input type="file" accept="application/pdf" onChange={handleFileUpload} disabled={uploading} hidden />
        </label>
        {path && <span className="resource-item-path">Uploaded</span>}
      </div>
      {uploadError && <span className="dashboard-error">{uploadError}</span>}
      <div className="resource-item-actions">
        <button className="action-btn approve-btn" disabled={saving || uploading || !path} onClick={add}>Add</button>
        <button className="action-btn reject-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

const SubjectPanel = ({ subjectRow, entry, onChanged, onOpen, draggable, onDragCommit }) => {
  const [expanded, setExpanded] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(subjectRow.name)
  const dragControls = useDragControls()

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
    if (!window.confirm(`Move "${subjectRow.name}" and all its resources to trash?`)) return
    const now = new Date().toISOString()
    await supabase.from('resources').update({ deleted_at: now }).eq('subject', subjectRow.name).eq('semester', subjectRow.semester).is('deleted_at', null)
    await supabase.from('subjects').update({ deleted_at: now }).eq('id', subjectRow.id)
    onChanged()
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
        <span className="subject-panel-count">{pyq.length + lab.length + (syllabus ? 1 : 0)} files</span>
        <div className="subject-panel-actions" onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn" onClick={() => setRenaming(true)} aria-label="Rename"><EditIcon sx={{ fontSize: 16 }} /></button>
          <button className="icon-btn" onClick={toggleElective} aria-label="Toggle elective">E</button>
          <button className="icon-btn danger" onClick={removeSubject} aria-label="Delete subject"><DeleteIcon sx={{ fontSize: 16 }} /></button>
        </div>
      </div>

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
              <AddResourceForm semester={subjectRow.semester} subject={subjectRow.name} type="syllabus" onAdded={onChanged} />
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
              <AddResourceForm semester={subjectRow.semester} subject={subjectRow.name} type={type} onAdded={onChanged} />
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
      onDragEnd={onDragCommit}
      className="subject-panel"
      whileDrag={{ scale: 1.01, boxShadow: '0 20px 45px rgba(0,0,0,0.4)', zIndex: 5 }}
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
      <label className="elective-checkbox">
        <input type="checkbox" checked={isElective} onChange={(e) => setIsElective(e.target.checked)} />
        Elective
      </label>
      <div className="resource-item-actions">
        <button className="action-btn approve-btn" disabled={saving} onClick={add}>Add</button>
        <button className="action-btn reject-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

const CALENDAR_REPO_PATH = 'pdfs/Academic_Calendar.pdf'

const AcademicCalendarPanel = ({ onOpen }) => {
  const [path, setPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    supabase
      .from('global_resources')
      .select('value')
      .eq('key', 'academic_calendar_path')
      .maybeSingle()
      .then(({ data }) => {
        setPath(data?.value || '')
        setLoading(false)
      })
  }, [])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setSaving(true)
    setUploadError('')
    try {
      const url = await uploadFileToGithub({
        file,
        repoPath: CALENDAR_REPO_PATH,
        commitMessage: 'Update academic calendar',
      })
      await supabase.from('global_resources').upsert({ key: 'academic_calendar_path', value: url, updated_at: new Date().toISOString() })
      setPath(url)
    } catch (err) {
      setUploadError(err.message)
    }
    setSaving(false)
  }

  const remove = async () => {
    if (!window.confirm('Remove the Academic Calendar link? The button on the site will have nothing to open.')) return
    setSaving(true)
    await supabase.from('global_resources').upsert({ key: 'academic_calendar_path', value: '', updated_at: new Date().toISOString() })
    setSaving(false)
    setPath('')
  }

  if (loading) {
    return (
      <div className="subject-panel academic-calendar-skeleton">
        <div className="subject-panel-header" style={{ cursor: 'default' }}>
          <span className="subject-panel-name">Academic Calendar</span>
          <span className="subject-panel-count skeleton-shimmer">&nbsp;</span>
        </div>
        <div className="subject-panel-body" style={{ borderTop: '1px solid rgba(var(--glass-rgb), 0.1)' }}>
          <div className="resource-item-row">
            <div className="resource-item-text">
              <span className="resource-item-name skeleton-shimmer">&nbsp;</span>
            </div>
          </div>
        </div>
      </div>
    )
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
              {saving ? '…' : <EditIcon sx={{ fontSize: 18 }} />}
              <input type="file" accept="application/pdf" onChange={handleUpload} disabled={saving} hidden />
            </label>
            {path && (
              <button className="icon-btn danger" onClick={remove} aria-label="Remove"><DeleteIcon sx={{ fontSize: 18 }} /></button>
            )}
          </div>
        </div>
        {uploadError && <p className="dashboard-error">{uploadError}</p>}
      </div>
    </div>
  )
}

const CentralSyllabusPanel = ({ semester, centralSyllabus, onOpen, onChanged }) => {
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const path = centralSyllabus[semester] || ''
  const settingKey = `syllabus_semester_${semester}`
  const repoPath = `pdfs/Semester${semester}/Syllabus.pdf`

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
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

  const remove = async () => {
    if (!window.confirm(`Remove the central syllabus for Semester ${semester}? Subjects without their own syllabus will show nothing.`)) return
    setSaving(true)
    await supabase.from('global_resources').upsert({ key: settingKey, value: '', updated_at: new Date().toISOString() })
    setSaving(false)
    onChanged()
  }

  return (
    <div className="subject-panel">
      <div className="subject-panel-header" style={{ cursor: 'default' }}>
        <span className="subject-panel-name">Central Syllabus — Semester {semester}</span>
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
              {saving ? '…' : <EditIcon sx={{ fontSize: 18 }} />}
              <input type="file" accept="application/pdf" onChange={handleUpload} disabled={saving} hidden />
            </label>
            {path && (
              <button className="icon-btn danger" onClick={remove} aria-label="Remove"><DeleteIcon sx={{ fontSize: 18 }} /></button>
            )}
          </div>
        </div>
        {uploadError && <p className="dashboard-error">{uploadError}</p>}
      </div>
    </div>
  )
}

const ResourcesTab = () => {
  const { subjectRows, resources, centralSyllabus, loading, error, refresh } = useResourcesData()
  const { openPdf } = usePDFWindows()
  const [semester, setSemester] = useState(1)
  const [semesterSubjectsOrder, setSemesterSubjectsOrder] = useState([])
  const [subjectOrderDirty, setSubjectOrderDirty] = useState(false)
  const [committingSubjectOrder, setCommittingSubjectOrder] = useState(false)

  const semesterSubjects = subjectRows
    .filter((row) => row.semester === semester && !row.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)

  useEffect(() => {
    setSemesterSubjectsOrder(semesterSubjects)
    setSubjectOrderDirty(false)
  }, [subjectRows, semester])

  const handleSubjectReorder = (newOrder) => {
    setSemesterSubjectsOrder(newOrder)
    setSubjectOrderDirty(true)
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

  return (
    <div className="dashboard-panel">
      <AcademicCalendarPanel onOpen={openPdf} />

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
          <Reorder.Group as="div" axis="y" values={semesterSubjectsOrder} onReorder={handleSubjectReorder} className="subject-list">
            {semesterSubjectsOrder.map((row) => (
              <SubjectPanel
                key={row.id}
                subjectRow={row}
                entry={resources[row.name]}
                onChanged={refresh}
                onOpen={openPdf}
                draggable
                onDragCommit={() => setSubjectOrderDirty(true)}
              />
            ))}
          </Reorder.Group>
          {subjectOrderDirty && (
            <ReorderConfirmBar onConfirm={confirmSubjectOrder} onCancel={cancelSubjectOrder} busy={committingSubjectOrder} />
          )}
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