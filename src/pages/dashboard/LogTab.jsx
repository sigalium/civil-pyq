import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/useAuth'
import { useResourcesData } from '../../context/useResourcesData'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import { useNotifications } from '../../context/useNotifications'
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
  if (entry.table_name === 'resources') {
    if (n?.resource_type === 'iscode') return `iscode|${n?.section_id}`
    return `${n?.subject}|${n?.semester}|${n?.resource_type}`
  }
  if (entry.table_name === 'subjects') return `${n?.semester}`
  if (entry.table_name === 'contributors') return `${n?.role_type}`
  return 'default'
}

function reorderContextLabel(entry, sectionsById = {}) {
  const { new: n } = unwrap(entry.details, entry.action)
  if (entry.table_name === 'resources') {
    if (n?.resource_type === 'iscode') {
      const sectionName = sectionsById[n?.section_id]?.name || 'Codes & Standards'
      return `codes in ${sectionName}`
    }
    return `${n?.resource_type === 'lab' ? 'lab files' : 'PYQs'} in ${n?.subject || 'an unknown subject'}`
  }
  if (entry.table_name === 'subjects') return `subjects in Sem ${n?.semester}`
  if (entry.table_name === 'contributors') return `${n?.role_type === 'faculty' ? 'faculty contributors' : 'student contributors'}`
  return 'items'
}

function clip(text, max = 90) {
  const cleaned = (text || '').trim().replace(/\s+/g, ' ')
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned
}

function photoKind(profilePic) {
  if (!profilePic) return 'none'
  if (/(^|\/)Contributor\/Default\//.test(profilePic)) return 'default'
  return 'custom'
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

function describeResources(action, details, sectionsById = {}) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const label = row?.name ? `"${row.name}"` : 'a resource'
  const isCode = row?.resource_type === 'iscode'
  const sectionName = (id) => sectionsById[id]?.name || 'Codes & Standards'
  const where = isCode ? sectionName(row?.section_id) : (row?.subject ? `${row.subject}, Sem ${row.semester}` : 'an unknown subject')

  if (action === 'INSERT') return isCode ? `added code ${label} to ${where}` : `added ${label} (${row?.resource_type || 'file'}) to ${where}`
  if (action === 'DELETE') return isCode ? `permanently deleted code ${label}` : `permanently deleted ${label}`
  if (action === 'UPDATE') {
    if (!o?.deleted_at && n?.deleted_at) return `moved ${label} to trash`
    if (o?.deleted_at && !n?.deleted_at) return `restored ${label} from trash`
    if (o?.name !== n?.name) return `renamed "${o?.name}" to "${n?.name}"`
    if (o?.path !== n?.path) return `replaced the file for ${label}`
    if (o?.description !== n?.description) return `updated the description for ${label}`
    if (isCode && o?.section_id !== n?.section_id) return `moved code ${label} to ${sectionName(n?.section_id)}`
    if (o?.sort_order !== n?.sort_order) return isCode ? `reordered code ${label}` : `reordered ${label}`
    if (!isCode && (o?.subject !== n?.subject || o?.semester !== n?.semester)) return `moved ${label} to ${where}`
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

function describeContributors(action, details, sectionsById, isSystem) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const label = row?.name ? `"${row.name}"` : 'a contributor'

  if (action === 'INSERT') return `added contributor ${label} (${row?.role_type || 'unknown'})`
  if (action === 'DELETE') {
    const withPhoto = !isSystem && photoKind(row?.profile_pic) === 'custom'
    return `permanently deleted contributor ${label}${withPhoto ? ' and removed their uploaded photo from GitHub' : ''}`
  }
  if (action === 'UPDATE') {
    if (!o?.deleted_at && n?.deleted_at) return `moved contributor ${label} to trash`
    if (o?.deleted_at && !n?.deleted_at) return `restored contributor ${label} from trash`

    const changes = []
    if (o?.name !== n?.name) {
      changes.push({ text: `renamed contributor "${o?.name}" to "${n?.name}"`, short: `renamed from "${o?.name}"` })
    }
    if (o?.is_top_contributor !== n?.is_top_contributor) {
      changes.push({
        text: `${n?.is_top_contributor ? 'marked' : 'unmarked'} ${label} as a top contributor`,
        short: n?.is_top_contributor ? 'marked as top contributor' : 'unmarked as top contributor',
      })
    }
    if (o?.profile_pic !== n?.profile_pic) {
      const kind = photoKind(n?.profile_pic)
      const short = kind === 'none' ? 'photo removed' : kind === 'default' ? 'default avatar' : 'new uploaded photo'
      const text =
        kind === 'none'
          ? `removed the photo of ${label}`
          : kind === 'default'
            ? `set a default avatar for ${label}`
            : `uploaded a new photo for ${label}`
      changes.push({ text, short })
    }
    if (o?.batch_year !== n?.batch_year) {
      changes.push({
        text: `changed the batch of ${label} from ${o?.batch_year || 'empty'} to ${n?.batch_year || 'empty'}`,
        short: `batch ${o?.batch_year || 'empty'} to ${n?.batch_year || 'empty'}`,
      })
    }
    if (o?.department !== n?.department) {
      changes.push({
        text: `changed the department of ${label} from ${o?.department || 'empty'} to ${n?.department || 'empty'}`,
        short: `department ${o?.department || 'empty'} to ${n?.department || 'empty'}`,
      })
    }

    if (changes.length === 1) return changes[0].text
    if (changes.length > 1) return `edited contributor ${label}: ${changes.map((c) => c.short).join(', ')}`
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
    if (n?.viewed_tutorial && !o?.viewed_tutorial) return `${label} finished the dashboard tour`
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
      if (n?.status === 'rejected') {
        return n?.rejection_reason
          ? `rejected submission ${label}${who} with the reason "${clip(n.rejection_reason)}"`
          : `rejected submission ${label}${who} without giving a reason`
      }
      if (n?.status === 'pending') return `undid the ${o?.status} decision for submission ${label}${who}`
      return `set submission ${label} to ${n?.status}`
    }
    if (o?.file_path !== n?.file_path) return `replaced the file of submission ${label}${who} with an edited version`
    if (o?.rejection_reason !== n?.rejection_reason) {
      return n?.rejection_reason
        ? `changed the rejection reason for submission ${label}${who} to "${clip(n.rejection_reason)}"`
        : `removed the rejection reason for submission ${label}${who}`
    }
    const changes = []
    if (o?.resource_label !== n?.resource_label) changes.push('name')
    if (o?.subject !== n?.subject) changes.push('subject')
    if (o?.semester !== n?.semester) changes.push('semester')
    if (o?.resource_type !== n?.resource_type) changes.push('type')
    if (changes.length) return `edited submission ${label}${who} (${changes.join(', ')})`
    return `updated submission ${label}${who}`
  }
  return `changed submission ${label}`
}

function describeAnnouncements(action, details) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const label = row?.title ? `"${row.title}"` : 'an announcement'

  if (action === 'INSERT') return `sent announcement ${label} to everyone`
  if (action === 'DELETE') return `permanently deleted announcement ${label}`
  if (action === 'UPDATE') {
    if (!o?.deleted_at && n?.deleted_at) return `deleted announcement ${label}`
    if (o?.deleted_at && !n?.deleted_at) return `restored announcement ${label}`
    const changes = []
    if (o?.title !== n?.title) changes.push('title')
    if (o?.message !== n?.message) changes.push('text')
    if (!!o?.title_underline !== !!n?.title_underline) changes.push(`title line turned ${n?.title_underline ? 'on' : 'off'}`)
    if (changes.length === 1 && changes[0] === 'title') return `renamed announcement "${o?.title}" to "${n?.title}"`
    if (changes.length) return `edited announcement ${label} (${changes.join(', ')})`
    return `updated announcement ${label}`
  }
  return `changed announcement ${label}`
}

function describeReplacedFiles(action, details) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const isPhoto = row?.resource_type === 'contributor photo'
  const name = (row?.resource_name || '').replace(/ \(contributor photo\)$/, '')
  const label = name ? `"${name}"` : isPhoto ? 'a contributor' : 'a resource'
  const noun = isPhoto ? `photo of ${label}` : `file of ${label}`

  if (action === 'INSERT') return `moved the old ${noun} to Replaced (it is deleted from GitHub after 30 days)`
  if (action === 'DELETE') return `permanently deleted the old ${noun} from GitHub`
  return `updated the Replaced entry for the ${noun}`
}

function describeContributorPhotos(action, details) {
  const { old: o, new: n } = unwrap(details, action)
  const row = o || n
  return `permanently deleted the photo of "${row?.name || 'a contributor'}" from GitHub`
}

function describeSections(action, details) {
  const { old: o, new: n } = unwrap(details, action)
  const row = n || o
  const label = row?.name ? `"${row.name}"` : 'a section'

  if (action === 'INSERT') return `added section ${label} to Codes & Standards`
  if (action === 'DELETE') return `permanently deleted section ${label}`
  if (action === 'UPDATE') {
    if (!o?.deleted_at && n?.deleted_at) return `moved section ${label} to trash`
    if (o?.deleted_at && !n?.deleted_at) return `restored section ${label} from trash`
    if (o?.name !== n?.name) return `renamed section "${o?.name}" to "${n?.name}"`
    if (o?.sort_order !== n?.sort_order) return `reordered section ${label}`
    return `updated section ${label}`
  }
  return `changed section ${label}`
}

function formatSettingValue(key, value) {
  if (value === 'true') return 'on'
  if (value === 'false') return 'off'
  if (key === 'maintenance_until' && value) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }
  return value || 'empty'
}

function describeGlobalResources(action, details) {
  const { new: n } = unwrap(details, action)
  const key = n?.key || 'a setting'
  const value = n?.value

  const syllabusMatch = key.match(/^syllabus_semester_(\d+)$/)
  if (syllabusMatch) {
    return value ? `changed Semester ${syllabusMatch[1]} syllabus` : `cleared Semester ${syllabusMatch[1]} syllabus`
  }
  if (key === 'academic_calendar_path') {
    return value ? 'changed the academic calendar' : 'cleared the academic calendar'
  }

  const label = key.replace(/_/g, ' ')
  return `set ${label} to ${formatSettingValue(key, value)}`
}

const CLEANUP_KIND_LABELS = { scheduled: 'monthly', fallback: 'fallback', emergency: 'emergency' }

function formatCleanupSize(kb) {
  if (!kb) return 'unknown'
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

function describeHistoryCleanup(action, details) {
  const kind = CLEANUP_KIND_LABELS[details?.kind] || 'history'
  const mode = details?.dry_run ? 'test run' : 'cleanup'
  switch (details?.event) {
    case 'started':
      return `started the ${kind} ${mode}${details.reason ? ` (reason: "${details.reason}")` : ''}`
    case 'succeeded':
      return details.dry_run
        ? `the ${kind} test run passed${(details.message || '').replace(/^Test run passed\.\s*/, '') ? `. ${details.message.replace(/^Test run passed\.\s*/, '')}` : ''}`
        : `finished the ${kind} cleanup. History was rewritten and every live and trash file was kept`
    case 'failed':
      return `the ${kind} ${mode} failed: ${details.message}`
    case 'rolled_back':
      return `the ${kind} cleanup was rolled back and nothing was lost: ${details.message}`
    case 'aborted':
      return `the ${kind} ${mode} did not run: ${details.message}`
    case 'followup':
      return `morning check passed. Repository size ${formatCleanupSize(details.repo_size_before_kb)} to ${formatCleanupSize(details.repo_size_after_kb)}`
    case 'health_failed':
      return `morning check found problems: ${details.message}`
    case 'error':
      return `the ${kind} ${mode} hit an unexpected error: ${details.message}`
    default:
      return `history cleanup event`
  }
}

function describeCleanupSettings(action, details) {
  if (action !== 'UPDATE') return 'changed the cleanup schedule'
  const o = details?.old
  const n = details?.new
  const changes = []
  if (o?.enabled !== n?.enabled) changes.push(n?.enabled ? 'turned the monthly cleanup on' : 'turned the monthly cleanup off')
  if (o?.run_day !== n?.run_day) changes.push(`moved the monthly cleanup from day ${o?.run_day} to day ${n?.run_day}`)
  if (o?.dry_run !== n?.dry_run) changes.push(n?.dry_run ? 'switched the cleanup to test mode' : 'switched the cleanup to live mode')
  if (o?.repo_pushed_at !== n?.repo_pushed_at) changes.push('recorded new repository activity')
  if (JSON.stringify(o?.skipped_months) !== JSON.stringify(n?.skipped_months)) {
    const added = (n?.skipped_months || []).filter((m) => !(o?.skipped_months || []).includes(m))
    const removed = (o?.skipped_months || []).filter((m) => !(n?.skipped_months || []).includes(m))
    if (added.length) changes.push(`skipped the cleanup for ${added.join(', ')}`)
    if (removed.length) changes.push(`restored the cleanup for ${removed.join(', ')}`)
  }
  return changes.length ? changes.join(' and ') : 'updated the cleanup settings'
}

const DESCRIBERS = {
  history_cleanup: describeHistoryCleanup,
  cleanup_settings: describeCleanupSettings,
  resources: describeResources,
  subjects: describeSubjects,
  contributors: describeContributors,
  admins: describeAdmins,
  submissions: describeSubmissions,
  global_resources: describeGlobalResources,
  announcements: describeAnnouncements,
  replaced_files: describeReplacedFiles,
  contributor_photos: describeContributorPhotos,
  sections: describeSections,
}

function describeEntry(entry, sectionsById = {}) {
  const describer = DESCRIBERS[entry.table_name]
  if (!describer) return `${entry.action.toLowerCase()} in ${entry.table_name}`
  try {
    const text = describer(entry.action, entry.details, sectionsById, entry.actor_email === 'system')
    if (entry.actor_email === 'system' && entry.action === 'DELETE') {
      return `${text.replace(/^permanently deleted/, 'automatically purged')} (30 days after it was removed)`
    }
    return text
  } catch {
    return `${entry.action.toLowerCase()} in ${entry.table_name}`
  }
}

const PAGE_SIZE = 40

const LogTab = () => {
  const { profile } = useAuth()
  const { sectionRows } = useResourcesData()
  const isOwner = profile?.role === 'owner'
  const sectionsById = sectionRows.reduce((acc, s) => {
    acc[s.id] = s
    return acc
  }, {})
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
  const { notify } = useNotifications()

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
          setError('Could not load the log.')
        } else {
          setEntries(data || [])
          setTotalCount(count || 0)
        }
        setLoading(false)
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
    notify({ variant: 'success', message: 'Log entry deleted.' })
  }

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return
    setDeleting(true)
    const count = selectedIds.size
    const { error: deleteError } = await supabase.from('audit_log').delete().in('id', [...selectedIds])
    setDeleting(false)
    setConfirmAction(null)
    if (deleteError) {
      setError('Could not delete the selected log entries.')
      return
    }
    exitSelectMode()
    fetchPage()
    notify({ variant: 'success', message: `${count} log entries deleted.` })
  }

  const emptyLog = async () => {
    setDeleting(true)
    const { error: deleteError } = await supabase.from('audit_log').delete().not('id', 'is', null)
    setDeleting(false)
    setConfirmAction(null)
    if (deleteError) {
      setError('Could not empty the log.')
      return
    }
    exitSelectMode()
    setPage(0)
    fetchPage()
    notify({ variant: 'success', message: 'Audit log cleared.' })
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
              <button className="action-btn neutral-btn" onClick={() => setSelectMode(true)}>Select</button>
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
                ? `reordered ${reorderContextLabel(first, sectionsById)}`
                : describeEntry(first, sectionsById)
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
        <button className="action-btn neutral-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Previous
        </button>
        <span className="pagination-status">Page {page + 1} of {totalPages}</span>
        <button className="action-btn neutral-btn" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>

      {confirmAction && (
        <div className="confirm-modal-overlay" onClick={() => !deleting && setConfirmAction(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmAction.type === 'empty' ? 'Empty log?' : 'Delete log entries?'}</h3>
            <p className="confirm-modal-hint">
              {confirmAction.type === 'empty'
                ? 'This permanently deletes every entry in the log. This cannot be undone.'
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

export default LogTab