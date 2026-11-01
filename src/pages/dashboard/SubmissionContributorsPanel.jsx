import { useCallback, useEffect, useMemo, useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt'
import { supabase } from '../../lib/supabaseClient'
import { useContributorsData } from '../../context/useContributorsData'
import { useNotifications } from '../../context/useNotifications'
import { contributorNameKey, normalizeContributorName } from '../../utils/submissionContributors'
import ConfirmModal from '../../components/ConfirmModal'
import './Dashboard.css'

const PAGE_SIZE = 10

const ROLE_LABELS = { student: 'Student', faculty: 'Faculty' }

const SubmissionContributorRow = ({ entry, listedRoles, busy, onPush, onDelete }) => {
  const [choosing, setChoosing] = useState(false)
  const availableRoles = Object.keys(ROLE_LABELS).filter((role) => !listedRoles.includes(role))

  return (
    <div className="resource-item-row submission-contributor-row">
      <div className="resource-item-text">
        <span className="resource-item-name">{entry.name}</span>
        <span className="resource-item-path">
          {entry.contributions} {entry.contributions === 1 ? 'contribution' : 'contributions'}
        </span>
      </div>
      <div className="submission-contributor-badges">
        {listedRoles.map((role) => (
          <span key={role} className={`submission-contributor-badge ${role}`}>
            {ROLE_LABELS[role]}
          </span>
        ))}
      </div>
      <span className="submission-contributor-count" aria-label={`${entry.contributions} contributions`}>
        {entry.contributions}
      </span>
      <div className="resource-item-actions submission-contributor-actions">
        {choosing ? (
          <>
            {availableRoles.map((role) => (
              <button
                key={role}
                className="action-btn approve-btn"
                disabled={busy}
                onClick={async () => {
                  await onPush(entry, role)
                  setChoosing(false)
                }}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
            <button className="action-btn preview-btn" onClick={() => setChoosing(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="action-btn preview-btn" disabled={busy || availableRoles.length === 0} onClick={() => setChoosing(true)}>
              <PersonAddAltIcon sx={{ fontSize: 16 }} />
              <span>{availableRoles.length === 0 ? 'Listed' : 'Push to public'}</span>
            </button>
            <button className="icon-btn danger" onClick={() => onDelete(entry)} disabled={busy} aria-label="Delete">
              <DeleteIcon sx={{ fontSize: 18 }} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const SubmissionContributorsPanel = () => {
  const { contributorRows, refresh: refreshContributors } = useContributorsData()
  const { notify } = useNotifications()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('submission_contributors')
      .select('id, name, contributions, created_at')
      .order('contributions', { ascending: false })
      .order('name', { ascending: true })
    if (loadError) {
      setError('Could not load submission contributors.')
    } else {
      setError('')
      setRows(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const listedByKey = useMemo(() => {
    const map = new Map()
    contributorRows
      .filter((row) => !row.deleted_at)
      .forEach((row) => {
        const key = contributorNameKey(row.name)
        if (!map.has(key)) map.set(key, [])
        if (!map.get(key).includes(row.role_type)) map.get(key).push(row.role_type)
      })
    return map
  }, [contributorRows])

  const filtered = useMemo(() => {
    const needle = contributorNameKey(query)
    if (!needle) return rows
    return rows.filter((row) => contributorNameKey(row.name).includes(needle))
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const handlePush = async (entry, role) => {
    const key = contributorNameKey(entry.name)
    const alreadyListed = (listedByKey.get(key) || []).includes(role)
    if (alreadyListed) {
      notify({ variant: 'error', message: `"${entry.name}" is already a ${ROLE_LABELS[role].toLowerCase()} contributor.` })
      return
    }
    setBusyId(entry.id)
    const sortOrder = contributorRows.filter((row) => !row.deleted_at && row.role_type === role).length
    const { error: insertError } = await supabase.from('contributors').insert({
      name: normalizeContributorName(entry.name),
      role_type: role,
      sort_order: sortOrder,
    })
    setBusyId(null)
    if (insertError) {
      notify({ variant: 'error', message: `Could not add "${entry.name}": ${insertError.message}` })
      return
    }
    refreshContributors()
    notify({ variant: 'success', message: `"${entry.name}" added to ${ROLE_LABELS[role].toLowerCase()} contributors.` })
  }

  const handleDelete = async () => {
    const entry = pendingDelete
    setPendingDelete(null)
    if (!entry) return
    setBusyId(entry.id)
    const { error: deleteError } = await supabase.from('submission_contributors').delete().eq('id', entry.id)
    setBusyId(null)
    if (deleteError) {
      notify({ variant: 'error', message: `Could not delete "${entry.name}": ${deleteError.message}` })
      return
    }
    setRows((previous) => previous.filter((row) => row.id !== entry.id))
    notify({
      variant: 'success',
      message: `"${entry.name}" was deleted.`,
      actionLabel: 'Undo',
      onAction: async () => {
        const { error: restoreError } = await supabase.from('submission_contributors').insert({ name: entry.name, contributions: entry.contributions })
        if (restoreError) {
          notify({ variant: 'error', message: `Could not undo: ${restoreError.message}` })
          return
        }
        load()
      },
    })
  }

  if (loading) return <p className="dashboard-empty">Loading...</p>
  if (error) return <p className="dashboard-error">{error}</p>

  return (
    <div className="resource-group">
      <h4>Submission Contributors</h4>
      <div className="submission-contributor-toolbar">
        <label className="submission-contributor-search">
          <SearchIcon sx={{ fontSize: 18 }} />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
            placeholder="Search names"
          />
        </label>
        <span className="submission-contributor-total">
          {filtered.length} {filtered.length === 1 ? 'name' : 'names'}
        </span>
      </div>

      {pageRows.length === 0 ? (
        <p className="dashboard-empty">{rows.length === 0 ? 'No submission contributors yet.' : 'No names match this search.'}</p>
      ) : (
        <div className="draggable-list">
          {pageRows.map((entry) => (
            <SubmissionContributorRow
              key={entry.id}
              entry={entry}
              listedRoles={listedByKey.get(contributorNameKey(entry.name)) || []}
              busy={busyId === entry.id}
              onPush={handlePush}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-bar">
          <button className="action-btn neutral-btn" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Previous
          </button>
          <span className="pagination-status">Page {safePage + 1} of {totalPages}</span>
          <button className="action-btn neutral-btn" disabled={safePage + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete name?"
          message={`"${pendingDelete.name}" will be removed from this list.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

export default SubmissionContributorsPanel
