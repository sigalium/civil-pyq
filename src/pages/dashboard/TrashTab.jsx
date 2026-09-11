import { useEffect, useState } from 'react'
import RestoreIcon from '@mui/icons-material/Restore'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import { useResourcesData } from '../../context/useResourcesData'
import { useContributorsData } from '../../context/useContributorsData'
import { useAuth } from '../../context/useAuth'
import { usePDFWindows } from '../../context/usePDFWindows'
import { supabase } from '../../lib/supabaseClient'
import { deleteFileFromGithub } from '../../utils/githubUpload'
import { extractRepoPathFromUrl } from '../../utils/resourceSnippet'
import ConfirmModal from '../../components/ConfirmModal'
import Select from '../../components/Select'
import './Dashboard.css'

const RETENTION_DAYS = 30

const SORT_OPTIONS = [
  { value: 'deleting-soonest', label: 'Deleting soon' },
  { value: 'deleting-latest', label: 'Deleting later' },
  { value: 'name-asc', label: 'Name (A to Z)' },
  { value: 'name-desc', label: 'Name (Z to A)' },
]

function sortTrashRows(rows, sortKey, getLabel) {
  const sorted = [...rows]
  if (sortKey === 'name-asc') {
    sorted.sort((a, b) => getLabel(a).localeCompare(getLabel(b)))
  } else if (sortKey === 'name-desc') {
    sorted.sort((a, b) => getLabel(b).localeCompare(getLabel(a)))
  } else if (sortKey === 'deleting-latest') {
    sorted.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())
  } else {
    sorted.sort((a, b) => new Date(a.deleted_at).getTime() - new Date(b.deleted_at).getTime())
  }
  return sorted
}

function daysLeftLabel(deletedAt) {
  const deletedTime = new Date(deletedAt).getTime()
  const expiryTime = deletedTime + RETENTION_DAYS * 24 * 60 * 60 * 1000
  const daysLeft = Math.ceil((expiryTime - Date.now()) / (24 * 60 * 60 * 1000))
  if (daysLeft <= 0) return { text: 'Deleting today', tier: 'critical' }
  if (daysLeft <= 3) return { text: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`, tier: 'critical' }
  if (daysLeft <= 10) return { text: `${daysLeft} days left`, tier: 'warning' }
  return { text: `${daysLeft} days left`, tier: 'normal' }
}

const TrashRow = ({ label, meta, deletedAt, onPreview, onRestore, onHardDelete, isOwner, busy }) => {
  const countdown = daysLeftLabel(deletedAt)
  return (
    <div className="resource-item-row">
      <div className="resource-item-text">
        <span className="resource-item-name">{label}</span>
        <span className="resource-item-path trash-item-meta">
          {meta} · trashed {new Date(deletedAt).toLocaleDateString()}
          {' · '}
          <span className={`trash-countdown trash-countdown-${countdown.tier}`}>{countdown.text}</span>
        </span>
      </div>
      <div className="resource-item-actions">
        {onPreview && (
          <button className="icon-btn" onClick={onPreview} disabled={busy} aria-label="Preview">
            <OpenInNewIcon sx={{ fontSize: 18 }} />
          </button>
        )}
        {onRestore && (
          <button className="icon-btn" onClick={onRestore} disabled={busy} aria-label="Restore"><RestoreIcon sx={{ fontSize: 18 }} /></button>
        )}
        {isOwner && (
          <button className="icon-btn danger" onClick={onHardDelete} disabled={busy} aria-label="Delete forever">
            <DeleteForeverIcon sx={{ fontSize: 18 }} />
          </button>
        )}
      </div>
    </div>
  )
}

const TrashTab = () => {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const { subjectRows, resourceRows, sections, refresh: refreshResources } = useResourcesData()
  const { contributorRows, refresh: refreshContributors } = useContributorsData()
  const { openPdf } = usePDFWindows()
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(null)
  const [subjectSort, setSubjectSort] = useState('deleting-soonest')
  const [resourceSort, setResourceSort] = useState('deleting-soonest')
  const [codeSort, setCodeSort] = useState('deleting-soonest')
  const [contributorSort, setContributorSort] = useState('deleting-soonest')
  const [replacedSort, setReplacedSort] = useState('deleting-soonest')
  const [replacedFiles, setReplacedFiles] = useState([])

  const refreshReplaced = async () => {
    const { data } = await supabase
      .from('replaced_files')
      .select('*')
      .order('deleted_at', { ascending: true })
    setReplacedFiles(data || [])
  }

  useEffect(() => {
    refreshReplaced()
  }, [])

  const trashedSubjects = sortTrashRows(subjectRows.filter((r) => r.deleted_at), subjectSort, (r) => r.name)
  const trashedResources = sortTrashRows(resourceRows.filter((r) => r.deleted_at && r.resource_type !== 'iscode'), resourceSort, (r) => r.name)
  const trashedCodes = sortTrashRows(resourceRows.filter((r) => r.deleted_at && r.resource_type === 'iscode'), codeSort, (r) => r.name)
  const trashedContributors = sortTrashRows(contributorRows.filter((r) => r.deleted_at), contributorSort, (r) => r.name)
  const trashedReplaced = sortTrashRows(replacedFiles, replacedSort, (r) => r.resource_name)

  const codeSectionLabel = (row) => sections.find((s) => s.id === row.section_id)?.name || 'Code'

  const restoreSubject = async (row) => {
    setError('')
    setMessage('')
    setBusyId(row.id)

    const { error: subjectError } = await supabase.from('subjects').update({ deleted_at: null }).eq('id', row.id)
    if (subjectError) {
      setError(`Could not restore "${row.name}": ${subjectError.message}`)
      setBusyId(null)
      return
    }

    const { data: restoredResources, error: resourcesError } = await supabase
      .from('resources')
      .update({ deleted_at: null })
      .eq('subject', row.name)
      .eq('semester', row.semester)
      .eq('deleted_at', row.deleted_at)
      .select('id')

    if (resourcesError) {
      setError(`"${row.name}" was restored, but its resources could not be: ${resourcesError.message}`)
    } else if (restoredResources && restoredResources.length > 0) {
      setMessage(`Restored "${row.name}" along with ${restoredResources.length} resource(s) trashed with it.`)
    } else {
      setMessage(`Restored "${row.name}".`)
    }

    setBusyId(null)
    refreshResources()
  }

  const hardDeleteSubject = async (id) => {
    setPending(null)
    setError('')
    setBusyId(id)
    const { error: deleteError } = await supabase.from('subjects').delete().eq('id', id)
    if (deleteError) setError(`Could not permanently delete this subject: ${deleteError.message}`)
    setBusyId(null)
    refreshResources()
  }

  const restoreResource = async (row) => {
    setError('')
    setMessage('')
    setBusyId(row.id)

    const parentSubject = subjectRows.find((s) => s.name === row.subject && s.semester === row.semester)

    if (parentSubject?.deleted_at) {
      const { error: subjectError } = await supabase.from('subjects').update({ deleted_at: null }).eq('id', parentSubject.id)
      if (subjectError) {
        setError(`Could not restore "${row.name}" because its subject "${row.subject}" couldn't be restored: ${subjectError.message}`)
        setBusyId(null)
        return
      }
    }

    const { error: resourceError } = await supabase.from('resources').update({ deleted_at: null }).eq('id', row.id)
    if (resourceError) {
      setError(`Could not restore "${row.name}": ${resourceError.message}`)
      setBusyId(null)
      return
    }

    setMessage(
      parentSubject?.deleted_at
        ? `Restored "${row.name}" and its subject "${row.subject}", which was also in trash.`
        : `Restored "${row.name}".`
    )
    setBusyId(null)
    refreshResources()
  }

  const hardDeleteResource = async (id) => {
    setPending(null)
    setError('')
    setBusyId(id)
    const row = resourceRows.find((r) => r.id === id)
    const repoPath = extractRepoPathFromUrl(row?.path)
    if (repoPath) {
      try {
        await deleteFileFromGithub({ repoPath, commitMessage: `Delete ${row.name}` })
      } catch (githubError) {
        setError(`Removed from the database, but the file on GitHub could not be deleted: ${githubError.message}`)
      }
    }
    const { error: deleteError } = await supabase.from('resources').delete().eq('id', id)
    if (deleteError) setError(`Could not permanently delete this resource: ${deleteError.message}`)
    setBusyId(null)
    refreshResources()
  }

  const restoreContributor = async (id) => {
    setError('')
    setBusyId(id)
    const { error: restoreError } = await supabase.from('contributors').update({ deleted_at: null }).eq('id', id)
    if (restoreError) setError(`Could not restore this contributor: ${restoreError.message}`)
    setBusyId(null)
    refreshContributors()
  }

  const hardDeleteContributor = async (id) => {
    setPending(null)
    setError('')
    setBusyId(id)
    const { error: deleteError } = await supabase.from('contributors').delete().eq('id', id)
    if (deleteError) setError(`Could not permanently delete this contributor: ${deleteError.message}`)
    setBusyId(null)
    refreshContributors()
  }

  const hardDeleteReplaced = async (row) => {
    setPending(null)
    setError('')
    setBusyId(row.id)
    const repoPath = extractRepoPathFromUrl(row.jsdelivr_url) || row.github_path
    if (repoPath) {
      try {
        await deleteFileFromGithub({ repoPath, commitMessage: `Delete replaced file ${row.resource_name}` })
      } catch (githubError) {
        setError(`Removed from the list, but the file on GitHub could not be deleted: ${githubError.message}`)
      }
    }
    const { error: deleteError } = await supabase.from('replaced_files').delete().eq('id', row.id)
    if (deleteError) setError(`Could not permanently delete this entry: ${deleteError.message}`)
    setBusyId(null)
    refreshReplaced()
  }

  const isEmpty = trashedSubjects.length === 0 && trashedResources.length === 0 && trashedCodes.length === 0 && trashedContributors.length === 0 && trashedReplaced.length === 0

  return (
    <div className="dashboard-panel">
      <p className="snippet-hint">
        Trashed items are deleted after 30 days.
      </p>

      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="dashboard-success">{message}</p>}

      {isEmpty && <p className="dashboard-empty">Trash is empty.</p>}

      {trashedSubjects.length > 0 && (
        <div className="resource-group">
          <div className="trash-section-header">
            <h4>Subjects</h4>
            <Select value={subjectSort} onChange={setSubjectSort} options={SORT_OPTIONS} icon={<FilterAltIcon sx={{ fontSize: 16 }} />} />
          </div>
          {trashedSubjects.map((row) => (
            <TrashRow
              key={row.id}
              label={row.name}
              meta={`Semester ${row.semester}`}
              deletedAt={row.deleted_at}
              onRestore={() => setPending({ action: () => restoreSubject(row), title: 'Restore subject?', message: `"${row.name}" will be restored to Semester ${row.semester} in Resources, along with any resources trashed at the same time.`, confirmLabel: 'Restore', danger: false })}
              onHardDelete={() => setPending({ action: () => hardDeleteSubject(row.id), title: 'Delete permanently?', message: `"${row.name}" will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete forever' })}
              isOwner={isOwner}
              busy={busyId === row.id}
            />
          ))}
        </div>
      )}

      {trashedResources.length > 0 && (
        <div className="resource-group">
          <div className="trash-section-header">
            <h4>Resources</h4>
            <Select value={resourceSort} onChange={setResourceSort} options={SORT_OPTIONS} icon={<FilterAltIcon sx={{ fontSize: 16 }} />} />
          </div>
          {trashedResources.map((row) => (
            <TrashRow
              key={row.id}
              label={row.name}
              meta={`${row.subject} · Semester ${row.semester} · ${row.resource_type}`}
              deletedAt={row.deleted_at}
              onPreview={row.path ? () => openPdf({ name: row.name, path: row.path, resourceId: row.id }) : null}
              onRestore={() => setPending({ action: () => restoreResource(row), title: 'Restore file?', message: `"${row.name}" will be restored to ${row.subject}, Semester ${row.semester}, under ${row.resource_type}.`, confirmLabel: 'Restore', danger: false })}
              onHardDelete={() => setPending({ action: () => hardDeleteResource(row.id), title: 'Delete permanently?', message: `"${row.name}" will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete forever' })}
              isOwner={isOwner}
              busy={busyId === row.id}
            />
          ))}
        </div>
      )}

      {trashedCodes.length > 0 && (
        <div className="resource-group">
          <div className="trash-section-header">
            <h4>Codes & Standards</h4>
            <Select value={codeSort} onChange={setCodeSort} options={SORT_OPTIONS} icon={<FilterAltIcon sx={{ fontSize: 16 }} />} />
          </div>
          {trashedCodes.map((row) => (
            <TrashRow
              key={row.id}
              label={row.name}
              meta={codeSectionLabel(row)}
              deletedAt={row.deleted_at}
              onPreview={row.path ? () => openPdf({ name: row.name, path: row.path, resourceId: row.id }) : null}
              onRestore={() => setPending({ action: () => restoreResource(row), title: 'Restore code?', message: `"${row.name}" will be restored to Codes & Standards.`, confirmLabel: 'Restore', danger: false })}
              onHardDelete={() => setPending({ action: () => hardDeleteResource(row.id), title: 'Delete permanently?', message: `"${row.name}" will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete forever' })}
              isOwner={isOwner}
              busy={busyId === row.id}
            />
          ))}
        </div>
      )}

      {trashedContributors.length > 0 && (
        <div className="resource-group">
          <div className="trash-section-header">
            <h4>Contributors</h4>
            <Select value={contributorSort} onChange={setContributorSort} options={SORT_OPTIONS} icon={<FilterAltIcon sx={{ fontSize: 16 }} />} />
          </div>
          {trashedContributors.map((row) => (
            <TrashRow
              key={row.id}
              label={row.name}
              meta={row.role_type}
              deletedAt={row.deleted_at}
              onRestore={() => setPending({ action: () => restoreContributor(row.id), title: 'Restore contributor?', message: `"${row.name}" will be restored to the ${row.role_type === 'faculty' ? 'Faculty' : 'Student'} Contributors list.`, confirmLabel: 'Restore', danger: false })}
              onHardDelete={() => setPending({ action: () => hardDeleteContributor(row.id), title: 'Delete permanently?', message: `"${row.name}" will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete forever' })}
              isOwner={isOwner}
              busy={busyId === row.id}
            />
          ))}
        </div>
      )}

      {trashedReplaced.length > 0 && (
        <div className="resource-group">
          <div className="trash-section-header">
            <h4>Replaced</h4>
            <Select value={replacedSort} onChange={setReplacedSort} options={SORT_OPTIONS} icon={<FilterAltIcon sx={{ fontSize: 16 }} />} />
          </div>
          <p className="snippet-hint">
            Old versions of files that were swapped out for a new upload. Restored automatically only by staying here; there is no "restore to live" for these, since a newer file already took their place.
          </p>
          {trashedReplaced.map((row) => (
            <TrashRow
              key={row.id}
              label={row.resource_name}
              meta={row.resource_type || 'Replaced file'}
              deletedAt={row.deleted_at}
              onPreview={row.jsdelivr_url ? () => openPdf({ name: row.resource_name, path: row.jsdelivr_url }) : null}
              onHardDelete={() => setPending({ action: () => hardDeleteReplaced(row), title: 'Delete permanently?', message: `The old version of "${row.resource_name}" will be permanently deleted from GitHub. This cannot be undone.`, confirmLabel: 'Delete forever' })}
              isOwner={isOwner}
              busy={busyId === row.id}
            />
          ))}
        </div>
      )}

      {pending && (
        <ConfirmModal
          title={pending.title}
          message={pending.message}
          confirmLabel={pending.confirmLabel}
          danger={pending.danger !== false}
          onConfirm={pending.action}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

export default TrashTab
