import { useEffect, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { useContributorsData } from '../../context/ContributorsDataContext'
import { supabase } from '../../lib/supabaseClient'
import { uploadFileToGithub, sanitizePathSegment, getFileExtension } from '../../utils/githubUpload'
import { DEFAULT_AVATARS, buildDefaultAvatarUrl, buildContributorPhotoUrl } from '../../utils/resourceSnippet'
import { persistOrder } from '../../utils/resourceOrdering'
import Select from '../../components/Select'
import './Dashboard.css'

const DEFAULT_AVATAR_OPTIONS = DEFAULT_AVATARS.map((a) => ({ value: buildDefaultAvatarUrl(a.file), label: a.label }))

async function uploadContributorPhoto(file, name) {
  const safeName = sanitizePathSegment(name) || 'contributor'
  const repoPath = `Contributor/${safeName}-${Date.now()}.${getFileExtension(file.name)}`
  return uploadFileToGithub({
    file,
    repoPath,
    commitMessage: `Add contributor photo for ${name || safeName}`,
  })
}

const ContributorRow = ({ contributor, onChanged, draggable, onDragCommit }) => {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(contributor.name)
  const [batchYear, setBatchYear] = useState(contributor.batch_year || '')
  const [department, setDepartment] = useState(contributor.department || '')
  const [profilePic, setProfilePic] = useState(contributor.profile_pic || '')
  const [isTop, setIsTop] = useState(contributor.is_top_contributor)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const dragControls = useDragControls()

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadContributorPhoto(file, name)
      setProfilePic(url)
    } catch (err) {
      setUploadError(err.message)
    }
    setUploading(false)
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('contributors').update({
      name,
      batch_year: batchYear || null,
      department: department || null,
      profile_pic: profilePic || null,
      is_top_contributor: isTop,
    }).eq('id', contributor.id)
    setSaving(false)
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    if (!window.confirm(`Move "${contributor.name}" to trash?`)) return
    await supabase.from('contributors').update({ deleted_at: new Date().toISOString() }).eq('id', contributor.id)
    onChanged()
  }

  if (editing) {
    return (
      <div className="resource-item-row editing">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        {contributor.role_type === 'student' ? (
          <input value={batchYear} onChange={(e) => setBatchYear(e.target.value)} placeholder="Batch year" />
        ) : (
          <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" />
        )}
        <div className="photo-upload-field">
          {profilePic && <img className="photo-upload-preview" src={profilePic} alt="" />}
          <label className="photo-upload-btn">
            {uploading ? 'Uploading…' : 'Upload photo'}
            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} hidden />
          </label>
          <div className="avatar-select-wrap">
            <Select
              value={profilePic}
              onChange={setProfilePic}
              options={DEFAULT_AVATAR_OPTIONS}
              placeholder="Or pick a default avatar"
            />
          </div>
          {uploadError && <span className="dashboard-error">{uploadError}</span>}
        </div>
        {contributor.role_type === 'student' && (
          <label className="elective-checkbox">
            <input type="checkbox" checked={isTop} onChange={(e) => setIsTop(e.target.checked)} />
            Top contributor
          </label>
        )}
        <div className="resource-item-actions">
          <button className="action-btn approve-btn" disabled={saving} onClick={save}>Save</button>
          <button className="action-btn reject-btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    )
  }

  const content = (
    <>
      {draggable ? (
        <span className="drag-handle" onPointerDown={(e) => dragControls.start(e)} title="Drag to reorder">
          <DragIndicatorIcon sx={{ fontSize: 18 }} />
        </span>
      ) : (
        <span className="drag-handle drag-handle-disabled">
          <DragIndicatorIcon sx={{ fontSize: 18 }} />
        </span>
      )}
      <img
        className="contributor-thumb"
        src={contributor.profile_pic ? buildContributorPhotoUrl(contributor.profile_pic) : buildDefaultAvatarUrl('jane.png')}
        alt=""
      />
      <div className="resource-item-text">
        <span className="resource-item-name">
          {contributor.name} {contributor.is_top_contributor && '👑'}
        </span>
        <span className="resource-item-path">
          {contributor.role_type === 'student' ? `Batch of ${contributor.batch_year || '—'}` : (contributor.department || '—')}
        </span>
      </div>
      <div className="resource-item-actions">
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit"><EditIcon sx={{ fontSize: 18 }} /></button>
        <button className="icon-btn danger" onClick={remove} aria-label="Trash"><DeleteIcon sx={{ fontSize: 18 }} /></button>
      </div>
    </>
  )

  if (!draggable) {
    return <div className="resource-item-row">{content}</div>
  }

  return (
    <Reorder.Item
      as="div"
      value={contributor}
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

const AddContributorForm = ({ roleType, sortOrder, onAdded }) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [batchYear, setBatchYear] = useState('')
  const [department, setDepartment] = useState('')
  const [profilePic, setProfilePic] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadContributorPhoto(file, name)
      setProfilePic(url)
    } catch (err) {
      setUploadError(err.message)
    }
    setUploading(false)
  }

  const add = async () => {
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('contributors').insert({
      name: name.trim(),
      role_type: roleType,
      batch_year: batchYear.trim() || null,
      department: department.trim() || null,
      profile_pic: profilePic.trim() || null,
      sort_order: sortOrder,
    })
    setSaving(false)
    setOpen(false)
    setName('')
    setBatchYear('')
    setDepartment('')
    setProfilePic('')
    onAdded()
  }

  if (!open) {
    return (
      <button className="add-inline-btn" onClick={() => setOpen(true)}>
        <AddIcon sx={{ fontSize: 16 }} /> Add {roleType}
      </button>
    )
  }

  return (
    <div className="resource-item-row editing">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoFocus />
      {roleType === 'student' ? (
        <input value={batchYear} onChange={(e) => setBatchYear(e.target.value)} placeholder="Batch year" />
      ) : (
        <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" />
      )}
      <div className="photo-upload-field">
        {profilePic && <img className="photo-upload-preview" src={profilePic} alt="" />}
        <label className="photo-upload-btn">
          {uploading ? 'Uploading…' : 'Upload photo'}
          <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} hidden />
        </label>
        <div className="avatar-select-wrap">
          <Select
            value={profilePic}
            onChange={setProfilePic}
            options={DEFAULT_AVATAR_OPTIONS}
            placeholder="Or pick a default avatar"
          />
        </div>
        {uploadError && <span className="dashboard-error">{uploadError}</span>}
      </div>
      <div className="resource-item-actions">
        <button className="action-btn approve-btn" disabled={saving} onClick={add}>Add</button>
        <button className="action-btn reject-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
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

const CONTRIBUTORS_PAGE_SIZE = 10

const PaginatedGroup = ({ title, items, roleType, onChanged }) => {
  const [page, setPage] = useState(0)
  const [order, setOrder] = useState(items)
  const [dirty, setDirty] = useState(false)
  const [committing, setCommitting] = useState(false)

  useEffect(() => {
    setOrder(items)
    setDirty(false)
  }, [items])

  const totalPages = Math.max(1, Math.ceil(order.length / CONTRIBUTORS_PAGE_SIZE))
  const pageItems = order.slice(page * CONTRIBUTORS_PAGE_SIZE, page * CONTRIBUTORS_PAGE_SIZE + CONTRIBUTORS_PAGE_SIZE)

  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(0)
  }, [totalPages, page])

  const handleReorder = (newPageOrder) => {
    const newFullOrder = [...order]
    newFullOrder.splice(page * CONTRIBUTORS_PAGE_SIZE, pageItems.length, ...newPageOrder)
    setOrder(newFullOrder)
    setDirty(true)
  }

  const confirmOrder = async () => {
    setCommitting(true)
    await persistOrder('contributors', order)
    setCommitting(false)
    setDirty(false)
    onChanged()
  }

  const cancelOrder = () => {
    setOrder(items)
    setDirty(false)
  }

  return (
    <div className="resource-group">
      <h4>{title}</h4>
      <Reorder.Group as="div" axis="y" values={pageItems} onReorder={handleReorder} className="draggable-list">
        {pageItems.map((c) => (
          <ContributorRow key={c.id} contributor={c} onChanged={onChanged} draggable onDragCommit={() => setDirty(true)} />
        ))}
      </Reorder.Group>
      {items.length === 0 && <p className="dashboard-empty">No {title.toLowerCase()} yet.</p>}
      {dirty && <ReorderConfirmBar onConfirm={confirmOrder} onCancel={cancelOrder} busy={committing} />}
      {totalPages > 1 && (
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
      <AddContributorForm roleType={roleType} sortOrder={items.length} onAdded={onChanged} />
    </div>
  )
}

const ContributorsTab = () => {
  const { contributorRows, loading, error, refresh } = useContributorsData()
  const students = contributorRows.filter((c) => c.role_type === 'student' && !c.deleted_at)
  const faculty = contributorRows.filter((c) => c.role_type === 'faculty' && !c.deleted_at)

  if (loading) return <p className="dashboard-empty">Loading...</p>
  if (error) return <p className="dashboard-error">{error}</p>

  return (
    <div className="dashboard-panel">
      <PaginatedGroup title="Student Contributors" items={students} roleType="student" onChanged={refresh} />
      <PaginatedGroup title="Faculty Contributors" items={faculty} roleType="faculty" onChanged={refresh} />
    </div>
  )
}

export default ContributorsTab