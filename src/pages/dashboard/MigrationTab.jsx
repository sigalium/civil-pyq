import { useState } from 'react'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import Select from '../../components/Select'
import { useResourcesData } from '../../context/useResourcesData'
import { useAuth } from '../../context/useAuth'
import { moveResourceToTop } from '../../utils/resourceOrdering'
import { buildStagingRepoPath, extractRepoPathFromUrl } from '../../utils/resourceSnippet'
import { migrateFileInGithub } from '../../utils/migrateFile'
import { backfillFileSizes } from '../../utils/backfillFileSizes'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const TYPE_LABELS = { pyq: 'PYQ', lab: 'Lab', syllabus: 'Syllabus' }

const MigrationTab = () => {
  const { subjectRows, resources, refresh } = useResourcesData()
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const [sourceSemester, setSourceSemester] = useState('')
  const [sourceSubject, setSourceSubject] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [targetSemester, setTargetSemester] = useState('')
  const [targetSubject, setTargetSubject] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [backfillBusy, setBackfillBusy] = useState(false)
  const [backfillResult, setBackfillResult] = useState(null)
  const [backfillError, setBackfillError] = useState('')

  const subjectOptionsFor = (semester) =>
    subjectRows
      .filter((row) => row.semester === Number(semester) && !row.deleted_at)
      .map((row) => ({ value: row.name, label: row.name }))

  const sourceEntry = sourceSubject ? resources[sourceSubject] : null
  const sourceItems = sourceEntry
    ? [
        ...(sourceEntry.pyq || []).map((r) => ({ ...r, resource_type: 'pyq' })),
        ...(sourceEntry.lab || []).map((r) => ({ ...r, resource_type: 'lab' })),
        ...(sourceEntry.syllabus ? [{ ...sourceEntry.syllabus, resource_type: 'syllabus' }] : []),
      ]
    : []

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const resetSource = (semester) => {
    setSourceSemester(semester)
    setSourceSubject('')
    setSelectedIds([])
  }

  const migrate = async () => {
    setError('')
    setMessage('')
    if (!targetSemester || !targetSubject) {
      setError('Choose a target semester and subject.')
      return
    }
    if (selectedIds.length === 0) {
      setError('Select at least one file to migrate.')
      return
    }
    if (targetSemester === sourceSemester && targetSubject === sourceSubject) {
      setError('Target is the same as the source.')
      return
    }

    setBusy(true)
    const items = sourceItems.filter((item) => selectedIds.includes(item.id))
    let failed = 0
    let warnings = 0

    for (const item of items) {
      try {
        const oldPath = extractRepoPathFromUrl(item.path)
        const newPath = buildStagingRepoPath({
          semester: targetSemester,
          subject: targetSubject,
          resource_type: item.resource_type,
          resource_label: item.name,
          file_path: item.path,
        })

        let newUrl = item.path
        if (oldPath && oldPath !== newPath) {
          const result = await migrateFileInGithub({ oldPath, newPath })
          newUrl = result.url
          if (result.warning) warnings += 1
        }

        await moveResourceToTop({
          id: item.id,
          semester: Number(targetSemester),
          subject: targetSubject,
          resource_type: item.resource_type,
          path: newUrl,
        })
      } catch {
        failed += 1
      }
    }

    setBusy(false)
    setSelectedIds([])
    refresh()

    if (failed > 0) {
      setError(`${failed} of ${items.length} file(s) could not be migrated.`)
    } else if (warnings > 0) {
      setMessage(`Migrated ${items.length} file(s), but ${warnings} old file(s) on GitHub could not be removed automatically — safe to delete by hand later.`)
    } else {
      setMessage(`Migrated ${items.length} file(s) to Sem ${targetSemester} - ${targetSubject}.`)
    }
  }

  const runBackfill = async () => {
    setBackfillError('')
    setBackfillResult(null)
    setBackfillBusy(true)
    try {
      const result = await backfillFileSizes()
      setBackfillResult(result)
      refresh()
    } catch (err) {
      setBackfillError(err.message)
    }
    setBackfillBusy(false)
  }

  return (
    <div className="dashboard-panel">
      <p className="snippet-hint">
        Reassign a file's subject or semester.
      </p>

      <div className="migration-columns">
        <div className="migration-column">
          <h4>From</h4>
          <div className="migration-fields">
            <Select
              value={sourceSemester}
              onChange={resetSource}
              options={SEMESTERS.map((s) => ({ value: s, label: `Sem ${s}` }))}
              placeholder="Semester"
            />
            <Select
              value={sourceSubject}
              onChange={(v) => { setSourceSubject(v); setSelectedIds([]) }}
              options={subjectOptionsFor(sourceSemester)}
              placeholder="Subject"
              disabled={!sourceSemester}
            />
          </div>

          {sourceSubject && (
            <div className="migration-item-list">
              {sourceItems.length === 0 ? (
                <p className="dashboard-empty">No files in this subject yet.</p>
              ) : (
                sourceItems.map((item) => (
                  <label className="elective-checkbox migration-item" key={item.id}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                    />
                    <span className="migration-item-label">
                      [{TYPE_LABELS[item.resource_type]}] {item.name}
                    </span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <div className="migration-arrow">
          <SwapHorizIcon sx={{ fontSize: 26 }} />
        </div>

        <div className="migration-column">
          <h4>To</h4>
          <div className="migration-fields">
            <Select
              value={targetSemester}
              onChange={(v) => { setTargetSemester(v); setTargetSubject('') }}
              options={SEMESTERS.map((s) => ({ value: s, label: `Sem ${s}` }))}
              placeholder="Semester"
            />
            <Select
              value={targetSubject}
              onChange={setTargetSubject}
              options={subjectOptionsFor(targetSemester)}
              placeholder="Subject"
              disabled={!targetSemester}
            />
          </div>
        </div>
      </div>

      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="dashboard-success">{message}</p>}

      <button className="action-btn approve-btn" onClick={migrate} disabled={busy}>
        {busy ? 'Migrating…' : `Migrate ${selectedIds.length || ''} selected`.trim()}
      </button>

      {isOwner && (
        <div className="backfill-panel">
          <h4>File size backfill</h4>
          <p className="snippet-hint">
            Fills in file sizes for older uploads that don't have one recorded yet. Safe to run again anytime.
          </p>
          <button className="action-btn preview-btn" onClick={runBackfill} disabled={backfillBusy}>
            {backfillBusy ? 'Running…' : 'Backfill file sizes'}
          </button>
          {backfillError && <p className="dashboard-error">{backfillError}</p>}
          {backfillResult && (
            <p className="dashboard-success">
              Checked {backfillResult.total}, updated {backfillResult.updated}
              {backfillResult.skipped ? `, skipped ${backfillResult.skipped} (non-GitHub path)` : ''}
              {backfillResult.failed ? `, ${backfillResult.failed} failed` : ''}.
              {backfillResult.sampleError ? ` Error: ${backfillResult.sampleError}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default MigrationTab
