import { useState } from 'react'
import RestoreIcon from '@mui/icons-material/Restore'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import { useResourcesData } from '../../context/ResourcesDataContext'
import { useContributorsData } from '../../context/ContributorsDataContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import './Dashboard.css'

const TrashRow = ({ label, meta, deletedAt, onRestore, onHardDelete, isOwner, busy }) => (
  <div className="resource-item-row">
    <div className="resource-item-text">
      <span className="resource-item-name">{label}</span>
      <span className="resource-item-path">
        {meta} · trashed {new Date(deletedAt).toLocaleDateString()}
      </span>
    </div>
    <div className="resource-item-actions">
      <button className="icon-btn" onClick={onRestore} disabled={busy} aria-label="Restore"><RestoreIcon sx={{ fontSize: 18 }} /></button>
      {isOwner && (
        <button className="icon-btn danger" onClick={onHardDelete} disabled={busy} aria-label="Delete forever">
          <DeleteForeverIcon sx={{ fontSize: 18 }} />
        </button>
      )}
    </div>
  </div>
)

const TrashTab = () => {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const { subjectRows, resourceRows, refresh: refreshResources } = useResourcesData()
  const { contributorRows, refresh: refreshContributors } = useContributorsData()
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const trashedSubjects = subjectRows.filter((r) => r.deleted_at)
  const trashedResources = resourceRows.filter((r) => r.deleted_at)
  const trashedContributors = contributorRows.filter((r) => r.deleted_at)

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
    if (!window.confirm('Permanently delete this subject? This cannot be undone.')) return
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
    if (!window.confirm('Permanently delete this resource? This cannot be undone.')) return
    setError('')
    setBusyId(id)
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
    if (!window.confirm('Permanently delete this contributor? This cannot be undone.')) return
    setError('')
    setBusyId(id)
    const { error: deleteError } = await supabase.from('contributors').delete().eq('id', id)
    if (deleteError) setError(`Could not permanently delete this contributor: ${deleteError.message}`)
    setBusyId(null)
    refreshContributors()
  }

  const isEmpty = trashedSubjects.length === 0 && trashedResources.length === 0 && trashedContributors.length === 0

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
          <h4>Subjects</h4>
          {trashedSubjects.map((row) => (
            <TrashRow
              key={row.id}
              label={row.name}
              meta={`Semester ${row.semester}`}
              deletedAt={row.deleted_at}
              onRestore={() => restoreSubject(row)}
              onHardDelete={() => hardDeleteSubject(row.id)}
              isOwner={isOwner}
              busy={busyId === row.id}
            />
          ))}
        </div>
      )}

      {trashedResources.length > 0 && (
        <div className="resource-group">
          <h4>Resources</h4>
          {trashedResources.map((row) => (
            <TrashRow
              key={row.id}
              label={row.name}
              meta={`${row.subject} · Semester ${row.semester} · ${row.resource_type}`}
              deletedAt={row.deleted_at}
              onRestore={() => restoreResource(row)}
              onHardDelete={() => hardDeleteResource(row.id)}
              isOwner={isOwner}
              busy={busyId === row.id}
            />
          ))}
        </div>
      )}

      {trashedContributors.length > 0 && (
        <div className="resource-group">
          <h4>Contributors</h4>
          {trashedContributors.map((row) => (
            <TrashRow
              key={row.id}
              label={row.name}
              meta={row.role_type}
              deletedAt={row.deleted_at}
              onRestore={() => restoreContributor(row.id)}
              onHardDelete={() => hardDeleteContributor(row.id)}
              isOwner={isOwner}
              busy={busyId === row.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default TrashTab
