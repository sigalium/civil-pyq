import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import './Dashboard.css'

function formatTime(iso) {
  const date = new Date(iso)
  const datePart = date.toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' })
  const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${datePart} ${timePart}`
}

function unwrap(details, action) {
  if (!details) return { old: null, new: null }
  if (action === 'UPDATE') return { old: details.old || null, new: details.new || null }
  if (action === 'DELETE') return { old: details, new: null }
  return { old: null, new: details }
}

function isPureSortOrderChange(entry) {
  if (entry.action !== 'UPDATE') return false
  const { old: o, new: n } = unwrap(entry.details, entry.action)
  if (!o || !n) return false
  const keys = new Set([...Object.keys(o), ...Object.keys(n)])
  for (const key of keys) {
    if (key === 'sort_order' || key === 'updated_at') continue
    if (o[key] !== n[key]) return false
  }
  return o.sort_order !== n.sort_order
}

function reorderContextKey(entry) {
  const { new: n } = unwrap(entry.details, entry.action)
  if (entry.table_name === 'resources') return `${n?.subject}|${n?.semester}|${n?.resource_type}`
  if (entry.table_name === 'subjects') return `${n?.semester}`
  if (entry.table_name === 'contributors') return `${n?.role_type}`
  return 'default'
}

function reorderContextLabel(entry) {
  const { new: n } = unwrap(entry.details, entry.action)
  if (entry.table_name === 'resources') return `${n?.resource_type === 'lab' ? 'lab files' : 'PYQs'} in ${n?.subject}`
  if (entry.table_name === 'subjects') return `subjects in Sem ${n?.semester}`
  if (entry.table_name === 'contributors') return `${n?.role_type === 'faculty' ? 'faculty contributors' : 'student contributors'}`
  return 'items'
}

function groupEntries(entries) {
  const groups = []
  let i = 0
  while (i < entries.length) {
    const entry = entries[i]
    if (isPureSortOrderChange(entry)) {
      const context = reorderContextKey(entry)
      const batch = [entry]
      let j = i + 1
      while (
        j < entries.length &&
        isPureSortOrderChange(entries[j]) &&
        entries[j].table_name === entry.table_name &&
        entries[j].actor_email === entry.actor_email &&
        reorderContextKey(entries[j]) === context &&
        Math.abs(new Date(entries[j - 1].created_at) - new Date(entries[j].created_at)) < 15000
      ) {
        batch.push(entries[j])
        j++
      }
      groups.push({ type: 'reorder', entries: batch })
      i = j
    } else {
      groups.push({ type: 'single', entries: [entry] })
      i++
    }
  }
  return groups
}

function describeResources(action, details) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const label = row?.name ? `"${row.name}"` : 'a resource'
  const where = row?.subject ? `${row.subject}, Sem ${row.semester}` : ''

  if (action === 'INSERT') return `added ${label} (${row?.resource_type || 'file'}) to ${where}`
  if (action === 'DELETE') return `permanently deleted ${label}`
  if (action === 'UPDATE') {
    if (!o?.deleted_at && n?.deleted_at) return `moved ${label} to trash`
    if (o?.deleted_at && !n?.deleted_at) return `restored ${label} from trash`
    if (o?.name !== n?.name) return `renamed "${o?.name}" to "${n?.name}"`
    if (o?.path !== n?.path) return `replaced the file for ${label}`
    if (o?.sort_order !== n?.sort_order) return `reordered ${label}`
    if (o?.subject !== n?.subject || o?.semester !== n?.semester) return `moved ${label} to ${where}`
    return `updated ${label}`
  }
  return `changed ${label}`
}

function describeSubjects(action, details) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const label = row?.name ? `"${row.name}"` : 'a subject'
  const where = row ? `Sem ${row.semester}` : ''

  if (action === 'INSERT') return `added subject ${label} to ${where}`
  if (action === 'DELETE') return `permanently deleted subject ${label}`
  if (action === 'UPDATE') {
    if (!o?.deleted_at && n?.deleted_at) return `moved subject ${label} to trash`
    if (o?.deleted_at && !n?.deleted_at) return `restored subject ${label} from trash`
    if (o?.name !== n?.name) return `renamed subject "${o?.name}" to "${n?.name}"`
    if (o?.is_elective !== n?.is_elective) return `marked ${label} as ${n?.is_elective ? 'elective' : 'core'}`
    if (o?.sort_order !== n?.sort_order) return `reordered subject ${label}`
    return `updated subject ${label}`
  }
  return `changed subject ${label}`
}

function describeContributors(action, details) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const label = row?.name ? `"${row.name}"` : 'a contributor'

  if (action === 'INSERT') return `added contributor ${label} (${row?.role_type || 'unknown'})`
  if (action === 'DELETE') return `permanently deleted contributor ${label}`
  if (action === 'UPDATE') {
    if (!o?.deleted_at && n?.deleted_at) return `moved contributor ${label} to trash`
    if (o?.deleted_at && !n?.deleted_at) return `restored contributor ${label} from trash`
    if (o?.is_top_contributor !== n?.is_top_contributor) return `${n?.is_top_contributor ? 'marked' : 'unmarked'} ${label} as a top contributor`
    if (o?.profile_pic !== n?.profile_pic) return `updated the photo for ${label}`
    if (o?.sort_order !== n?.sort_order) return `reordered contributor ${label}`
    return `updated contributor ${label}`
  }
  return `changed contributor ${label}`
}

function describeAdmins(action, details) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const label = row?.username || row?.email || 'an admin'

  if (action === 'INSERT') return `added ${label} as an admin`
  if (action === 'DELETE') return `removed admin access for ${label}`
  if (action === 'UPDATE') {
    const permFields = Object.keys(n || {}).filter((k) => k.startsWith('can_'))
    const changed = permFields.filter((k) => o?.[k] !== n?.[k])
    if (changed.length > 0) {
      const granted = changed.filter((k) => n[k]).map((k) => k.replace('can_', '').replace(/_/g, ' '))
      const revoked = changed.filter((k) => !n[k]).map((k) => k.replace('can_', '').replace(/_/g, ' '))
      const parts = []
      if (granted.length) parts.push(`granted ${granted.join(', ')}`)
      if (revoked.length) parts.push(`revoked ${revoked.join(', ')}`)
      return `${parts.join(' and ')} for ${label}`
    }
    return `updated ${label}`
  }
  return `changed admin ${label}`
}

function describeSubmissions(action, details) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const label = row?.resource_label ? `"${row.resource_label}"` : 'a submission'
  const who = row?.student_name ? ` from ${row.student_name}` : ''

  if (action === 'INSERT') return `received a new submission ${label}${who} (${row?.subject}, Sem ${row?.semester})`
  if (action === 'UPDATE') {
    if (o?.status !== n?.status) {
      if (n?.status === 'approved') return `approved submission ${label}${who}`
      if (n?.status === 'rejected') return `rejected submission ${label}${who}`
      return `set submission ${label} to ${n?.status}`
    }
    return `updated submission ${label}`
  }
  return `changed submission ${label}`
}

function describeGlobalResources(action, details) {
  const { new: n } = unwrap(details, action)
  const key = n?.key || 'a setting'
  return `updated ${key.replace(/_/g, ' ')}`
}

const DESCRIBERS = {
  resources: describeResources,
  subjects: describeSubjects,
  contributors: describeContributors,
  admins: describeAdmins,
  submissions: describeSubmissions,
  global_resources: describeGlobalResources,
}

function describeEntry(entry) {
  const describer = DESCRIBERS[entry.table_name]
  if (!describer) return `${entry.action.toLowerCase()} in ${entry.table_name}`
  try {
    return describer(entry.action, entry.details)
  } catch {
    return `${entry.action.toLowerCase()} in ${entry.table_name}`
  }
}

const PAGE_SIZE = 40

const AuditLogTab = () => {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const [entries, setEntries] = useState([])
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actorNames, setActorNames] = useState({})
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmAction, setConfirmAction] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase
      .from('admins')
      .select('email, username')
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach((a) => { if (a.username) map[a.email] = a.username })
        setActorNames(map)
      })
  }, [])

  useEffect(() => {
    fetchPage()
  }, [page])

  const fetchPage = () => {
    setLoading(true)
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
      .then(({ data, count, error: fetchError }) => {
        if (fetchError) {
          setError('Could not load the audit log.')
        } else {
          setEntries(data || [])
          setTotalCount(count || 0)
        }
        setLoading(false)
      })
  }

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const deleteSingle = async (id) => {
    setDeleting(true)
    const { error: deleteError } = await supabase.from('audit_log').delete().eq('id', id)
    setDeleting(false)
    setConfirmAction(null)
    if (deleteError) {
      setError('Could not delete that log entry.')
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    fetchPage()
  }

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return
    setDeleting(true)
    const { error: deleteError } = await supabase.from('audit_log').delete().in('id', [...selectedIds])
    setDeleting(false)
    setConfirmAction(null)
    if (deleteError) {
      setError('Could not delete the selected log entries.')
      return
    }
    exitSelectMode()
    fetchPage()
  }

  const emptyLog = async () => {
    setDeleting(true)
    const { error: deleteError } = await supabase.from('audit_log').delete().not('id', 'is', null)
    setDeleting(false)
    setConfirmAction(null)
    if (deleteError) {
      setError('Could not empty the audit log.')
      return
    }
    exitSelectMode()
    setPage(0)
    fetchPage()
  }

  if (loading) return <p className="dashboard-empty">Loading...</p>
  if (error) return <p className="dashboard-error">{error}</p>

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const groups = groupEntries(entries)

  return (
    <div className="dashboard-panel">
      {isOwner && entries.length > 0 && (
        <div className="audit-log-toolbar">
          {selectMode ? (
            <>
              <span className="pagination-status">{selectedIds.size} selected</span>
              <button
                className="action-btn reject-btn"
                disabled={selectedIds.size === 0}
                onClick={() => setConfirmAction({ type: 'selected' })}
              >
                <DeleteIcon sx={{ fontSize: 16 }} /> Delete selected
              </button>
              <button className="icon-btn" onClick={exitSelectMode} aria-label="Cancel selection">
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </>
          ) : (
            <>
              <button className="action-btn reject-btn" onClick={() => setSelectMode(true)}>Select</button>
              <button className="action-btn reject-btn" onClick={() => setConfirmAction({ type: 'empty' })}>
                <DeleteIcon sx={{ fontSize: 16 }} /> Empty log
              </button>
            </>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="dashboard-empty">No activity logged yet.</p>
      ) : (
        <div className="audit-log-panel">
          <div className="audit-log-body">
            {groups.map((group) => {
              const first = group.entries[0]
              const groupIds = group.entries.map((e) => e.id)
              const text = group.type === 'reorder' && group.entries.length > 1
                ? `reordered ${reorderContextLabel(first)}`
                : describeEntry(first)
              const groupSelected = groupIds.every((id) => selectedIds.has(id))
              return (
                <div className="audit-terminal-line" key={first.id}>
                  {selectMode && isOwner && (
                    <input
                      type="checkbox"
                      className="audit-terminal-checkbox"
                      checked={groupSelected}
                      onChange={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (groupSelected) groupIds.forEach((id) => next.delete(id))
                          else groupIds.forEach((id) => next.add(id))
                          return next
                        })
                      }}
                    />
                  )}
                  <span className="audit-terminal-prompt">$</span>
                  <span className="audit-terminal-time">[{formatTime(first.created_at)}]</span>
                  <span className="audit-terminal-actor">{actorNames[first.actor_email] || first.actor_email}</span>
                  <span className="audit-terminal-text">{text}</span>
                  {isOwner && !selectMode && (
                    <button
                      className="icon-btn audit-terminal-delete"
                      onClick={() => setConfirmAction({ type: 'single', ids: groupIds })}
                      aria-label="Delete log entry"
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </button>
                  )}
                </div>
              )
            })}
            {page === 0 && (
              <div className="audit-terminal-line audit-terminal-cursor-line">
                <span className="audit-terminal-prompt">$</span>
                <span className="audit-terminal-cursor">_</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pagination-bar">
        <button className="action-btn reject-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Previous
        </button>
        <span className="pagination-status">Page {page + 1} of {totalPages}</span>
        <button className="action-btn reject-btn" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>

      {confirmAction && (
        <div className="confirm-modal-overlay" onClick={() => !deleting && setConfirmAction(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmAction.type === 'empty' ? 'Empty audit log?' : 'Delete log entries?'}</h3>
            <p className="confirm-modal-hint">
              {confirmAction.type === 'empty'
                ? 'This permanently deletes every entry in the audit log. This cannot be undone.'
                : confirmAction.type === 'selected'
                  ? `This permanently deletes ${selectedIds.size} selected entr${selectedIds.size === 1 ? 'y' : 'ies'}. This cannot be undone.`
                  : 'This permanently deletes this log entry. This cannot be undone.'}
            </p>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-btn cancel" disabled={deleting} onClick={() => setConfirmAction(null)}>Cancel</button>
              <button
                className="confirm-modal-btn confirm"
                disabled={deleting}
                onClick={() => {
                  if (confirmAction.type === 'empty') emptyLog()
                  else if (confirmAction.type === 'selected') deleteSelected()
                  else deleteSingle(confirmAction.ids[0])
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditLogTab