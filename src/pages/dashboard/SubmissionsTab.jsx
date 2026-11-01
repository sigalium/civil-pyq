import { useCallback, useEffect, useRef, useState } from 'react'
import Select from '../../components/Select'
import RejectReasonModal from '../../components/RejectReasonModal'
import FileToolTags from '../../components/FileToolTags'
import PDFToolModal from '../../components/PDFToolModal'
import { usePdfToolMeta } from '../../components/usePdfToolMeta'
import { useResourcesData } from '../../context/useResourcesData'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/useAuth'
import { usePDFWindows } from '../../context/usePDFWindows'
import { buildStagingRepoPath } from '../../utils/resourceSnippet'
import { uploadFileToGithub } from '../../utils/githubUpload'
import { insertResourceOnTop } from '../../utils/resourceOrdering'
import { scanFileForMalware, checkScanStatus } from '../../utils/malwareScan'
import { useNotifications } from '../../context/useNotifications'
import { recordSubmissionContributor } from '../../utils/submissionContributors'
import { Check, TriangleAlert } from 'lucide-react'
import { isScanning, setScanEntry, useScanEntry } from '../../utils/scanStore'
import './Dashboard.css'

const RESOURCE_TYPES = ['pyq', 'lab', 'syllabus', 'semester_syllabus', 'other']
const RESOURCE_TYPE_LABELS = { pyq: 'PYQ', lab: 'Lab', syllabus: 'Syllabus', semester_syllabus: 'Semester Syllabus', other: 'Other' }
const STATUSES = ['pending', 'approved', 'rejected']
const RESOURCE_TYPE_OPTIONS = RESOURCE_TYPES.map((t) => ({ value: t, label: RESOURCE_TYPE_LABELS[t] }))
const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }))

function startOfWeekIso() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

const SubmissionCard = ({ submission, subjects, onChanged, onPreview, onDownload, onApprove, onReject, onCompress, busy, canCompress, compressing, toolMeta }) => {
  const pdfTool = usePdfToolMeta()
  const [editing, setEditing] = useState(false)
  const [semester, setSemester] = useState(submission.semester)
  const [subject, setSubject] = useState(submission.subject)
  const [resourceType, setResourceType] = useState(submission.resource_type)
  const [resourceLabel, setResourceLabel] = useState(submission.resource_label)
  const [saving, setSaving] = useState(false)
  const { setStatus } = useNotifications()
  const scanEntry = useScanEntry(submission.id)
  const scanning = scanEntry?.state === 'scanning'
  const scan = scanEntry?.result || null
  const scanError = scanEntry?.error || ''
  const [manualUploadConfirmed, setManualUploadConfirmed] = useState(false)

  const isOther = submission.resource_type === 'other'

  const runScan = async () => {
    if (isScanning(submission.id)) return
    const key = `scan-${submission.id}`
    const label = submission.resource_label
    setScanEntry(submission.id, { state: 'scanning' })
    setStatus(key, { message: `Scanning "${label}"…`, variant: 'info', icon: <span className="notification-spinner" /> })
    try {
      const { data, error } = await supabase.storage.from('pending-uploads').download(submission.file_path)
      if (error || !data) throw new Error('Could not read the file to scan.')
      let result = await scanFileForMalware(data)
      let tries = 0
      while (result.status === 'pending' && tries < 5) {
        await new Promise((r) => setTimeout(r, 4000))
        result = await checkScanStatus(result.analysisId)
        tries += 1
      }
      setScanEntry(submission.id, { state: 'done', result })
      if (result.status !== 'completed') {
        setStatus(key, { message: `"${label}": scan still running.`, variant: 'warning', icon: <TriangleAlert size={16} />, dismissible: true })
      } else if (result.malicious) {
        setStatus(key, { message: `"${label}": flagged by ${result.stats?.malicious || 0} engines.`, variant: 'error', icon: <TriangleAlert size={16} />, dismissible: true })
      } else if (result.suspicious) {
        setStatus(key, { message: `"${label}": marked suspicious by ${result.stats?.suspicious || 0} engines.`, variant: 'warning', icon: <TriangleAlert size={16} />, dismissible: true })
      } else {
        setStatus(key, { message: `"${label}": no threats found.`, variant: 'success', icon: <Check size={16} />, dismissible: true })
      }
    } catch (err) {
      setScanEntry(submission.id, { state: 'error', error: err.message })
      setStatus(key, { message: `"${label}": ${err.message}`, variant: 'error', icon: <TriangleAlert size={16} />, dismissible: true })
    }
  }

  const semesterOptions = Object.keys(subjects).filter((k) => subjects[k]).map((sem) => ({ value: Number(sem), label: `Semester ${sem}` }))
  const subjectOptions = (subjects[semester] || []).map((s) => ({ value: s, label: s }))

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('submissions')
      .update({ semester, subject, resource_type: resourceType, resource_label: resourceLabel })
      .eq('id', submission.id)
    setSaving(false)
    if (!error) {
      setEditing(false)
      onChanged()
    }
  }

  if (editing) {
    return (
      <div className="submission-card editing">
        <div className="submission-info submission-edit-grid">
          <label className="upload-field">
            <span>Semester</span>
            <Select value={semester} onChange={(v) => { setSemester(v); setSubject('') }} options={semesterOptions} />
          </label>
          <label className="upload-field">
            <span>Subject</span>
            <Select value={subject} onChange={setSubject} options={subjectOptions} placeholder="Select subject" />
          </label>
          <label className="upload-field">
            <span>Type</span>
            <Select value={resourceType} onChange={setResourceType} options={RESOURCE_TYPE_OPTIONS} />
          </label>
          <label className="upload-field upload-field-wide">
            <span>Label</span>
            <input type="text" value={resourceLabel} onChange={(e) => setResourceLabel(e.target.value)} />
          </label>
        </div>
        {canCompress && (
          <div className="submission-edit-file">
            <div>
              <strong>PDF file</strong>
              <span>Pages, crop, filters and compression. Saved immediately.</span>
            </div>
            <button className="action-btn preview-btn compress-btn" onClick={() => onCompress(submission)} disabled={busy || compressing}>
              <pdfTool.Icon sx={{ fontSize: 16 }} />
              <span>{compressing ? pdfTool.busyLabel : pdfTool.label}</span>
            </button>
          </div>
        )}
        <div className="submission-actions submission-edit-actions">
          <button className="action-btn preview-btn" onClick={() => setEditing(false)}>Close</button>
          <button className="action-btn approve-btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save details'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="submission-card">
      <div className="submission-info">
        <h3>{submission.resource_label}<FileToolTags meta={toolMeta} /></h3>
        <p>
          {[submission.semester ? `Semester ${submission.semester}` : null, submission.subject, RESOURCE_TYPE_LABELS[submission.resource_type] || submission.resource_type].filter(Boolean).join(' · ')}
        </p>
        <p className="submission-meta">
          {submission.student_name || 'Anonymous'} · {new Date(submission.created_at).toLocaleString()}
        </p>
      </div>
      <div className="submission-actions">
        <button className="action-btn preview-btn" onClick={() => onPreview(submission)}>
          Preview
        </button>
        {submission.status === 'pending' && (
          <>
            <button className="action-btn preview-btn" onClick={() => onDownload(submission)}>
              Download
            </button>
            <button className="action-btn preview-btn" onClick={runScan} disabled={scanning}>
              {scanning ? 'Scanning…' : 'Scan for malware'}
            </button>
            <button className="action-btn preview-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
            {!isOther && (
              <button
                className="action-btn approve-btn"
                onClick={() => onApprove(submission, false)}
                disabled={busy}
              >
                {busy ? 'Publishing…' : 'Approve'}
              </button>
            )}
            <button
              className="action-btn reject-btn"
              onClick={() => onReject(submission)}
              disabled={busy}
            >
              Reject
            </button>
          </>
        )}
      </div>
      {isOther && submission.status === 'pending' && (
        <div className="submission-other-panel">
          <p className="submission-other-note">
            Submitted as "Other". Needs manual placement (Codes &amp; Standards, a semester syllabus, etc.).
          </p>
          <label className="toggle-switch-field submission-manual-toggle">
            <span>I've already uploaded this file manually</span>
            <span
              className={`toggle-switch ${manualUploadConfirmed ? 'on' : ''}`}
              onClick={() => setManualUploadConfirmed((v) => !v)}
            >
              <span className="toggle-switch-knob" />
            </span>
          </label>
          <p className="submission-other-warning">
            Marks it approved and deletes the submitted copy. Nothing is published.
          </p>
          {manualUploadConfirmed && (
            <button
              className="action-btn approve-btn"
              onClick={() => onApprove(submission, true)}
              disabled={busy}
            >
              {busy ? 'Approving…' : 'Approve submission'}
            </button>
          )}
        </div>
      )}
      {scanError && <p className="dashboard-error">{scanError}</p>}
      {scan?.status === 'completed' && (
        <p className={scan.malicious ? 'dashboard-error' : 'dashboard-success'}>
          {scan.malicious
            ? `Flagged malicious by ${scan.stats?.malicious || 0} scan engine(s).`
            : scan.suspicious
              ? `Marked suspicious by ${scan.stats?.suspicious || 0} scan engine(s).`
              : 'Clean. No scan engine flagged this file.'}
        </p>
      )}
      {scan?.status === 'pending' && (
        <p className="dashboard-error">Scan is still running on VirusTotal. Try again in a minute.</p>
      )}
    </div>
  )
}

const PAGE_SIZE = 20

const SubmissionsTab = () => {
  const { session, profile } = useAuth()
  const canCompress = !!profile
  const { subjectRows, subjects, refresh: refreshResources } = useResourcesData()
  const { openPdf } = usePDFWindows()
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [semesterFilter, setSemesterFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [approvedThisWeek, setApprovedThisWeek] = useState(0)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [compressingId, setCompressingId] = useState(null)
  const [compressTarget, setCompressTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [toolMetaById, setToolMetaById] = useState({})
  const { notify } = useNotifications()
  const initializedRef = useRef(false)
  const rejectCleanups = useRef(new Map())

  const flushRejectCleanups = useCallback(() => {
    rejectCleanups.current.forEach((entry) => {
      clearTimeout(entry.timer)
      supabase.storage.from('pending-uploads').remove([entry.path])
    })
    rejectCleanups.current.clear()
  }, [])

  useEffect(() => {
    window.addEventListener('pagehide', flushRejectCleanups)
    return () => {
      window.removeEventListener('pagehide', flushRejectCleanups)
      flushRejectCleanups()
    }
  }, [flushRejectCleanups])

  const semesters = [...new Set(subjectRows.map((row) => row.semester))].sort((a, b) => a - b)

  useEffect(() => {
    setPage(0)
  }, [semesterFilter, typeFilter, statusFilter])

  const fetchSubmissions = useCallback(async () => {
    if (!initializedRef.current) setLoading(true)
    let query = supabase.from('submissions').select('*', { count: 'exact' }).order('created_at', { ascending: false })

    if (semesterFilter) query = query.eq('semester', Number(semesterFilter))
    if (typeFilter) query = query.eq('resource_type', typeFilter)
    if (statusFilter) query = query.eq('status', statusFilter)

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, count, error } = await query.range(from, to)
    if (!error && data) {
      setSubmissions(data)
      setTotalCount(count || 0)
    }
    setLoading(false)
    initializedRef.current = true
  }, [semesterFilter, typeFilter, statusFilter, page])

  const fetchStats = useCallback(async () => {
    const { count: pending } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    const { count: approvedWeek } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('reviewed_at', startOfWeekIso())

    setPendingCount(pending || 0)
    setApprovedThisWeek(approvedWeek || 0)
  }, [])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const handlePreview = async (submission) => {
    setActionError('')
    const { data, error } = await supabase.storage
      .from('pending-uploads')
      .createSignedUrl(submission.file_path, 600)

    if (error || !data) {
      setActionError('Could not load a preview for this file.')
      return
    }
    openPdf({ name: submission.resource_label, path: data.signedUrl })
  }

  const handleDownload = async (submission) => {
    setActionError('')
    const { data, error } = await supabase.storage
      .from('pending-uploads')
      .createSignedUrl(submission.file_path, 600, { download: true })

    if (error || !data) {
      setActionError('Could not prepare a download link for this file.')
      return
    }
    const link = document.createElement('a')
    link.href = data.signedUrl
    link.download = `${submission.resource_label}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCompress = async (submission) => {
    setActionError('')
    setCompressingId(submission.id)
    const { data, error } = await supabase.storage.from('pending-uploads').download(submission.file_path)
    if (error || !data) {
      setActionError('Could not read the uploaded file.')
      setCompressingId(null)
      return
    }
    const file = new File([data], submission.file_path.split('/').pop() || 'document.pdf', { type: 'application/pdf' })
    setCompressTarget({ submission, file })
  }

  const handleApplyCompression = async (compressedFile, meta) => {
    if (!compressTarget) return
    const { submission } = compressTarget
    const { error } = await supabase.storage
      .from('pending-uploads')
      .upload(submission.file_path, compressedFile, { upsert: true, contentType: 'application/pdf' })
    setCompressTarget(null)
    setCompressingId(null)
    if (error) {
      setActionError('Could not save the edited file: ' + error.message)
      return
    }
    setToolMetaById((prev) => ({ ...prev, [submission.id]: meta || null }))
    setActionMessage('Edited file saved.')
  }

  const handleApprove = async (submission, manualUploadConfirmed) => {
    setActionError('')
    setActionMessage('')
    setBusyId(submission.id)

    if (submission.resource_type === 'other') {
      if (!manualUploadConfirmed) {
        setActionError('Confirm the manual upload toggle before approving an "Other" submission.')
        setBusyId(null)
        return
      }
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          status: 'approved',
          reviewed_by: session?.user?.email || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission.id)

      if (updateError) {
        setActionError('Could not mark this submission approved.')
        setBusyId(null)
        return
      }

      await recordSubmissionContributor(submission.student_name)
      await supabase.storage.from('pending-uploads').remove([submission.file_path])
      setActionMessage(`Marked approved: ${submission.resource_label}.`)
      notify({ variant: 'success', message: `Marked approved: ${submission.resource_label}.` })
      setBusyId(null)
      fetchSubmissions()
      fetchStats()
      return
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('pending-uploads')
      .download(submission.file_path)

    if (downloadError || !fileBlob) {
      setActionError('Could not read the uploaded file from storage.')
      setBusyId(null)
      return
    }

    let publishedUrl
    try {
      if (submission.resource_type === 'semester_syllabus') {
        publishedUrl = await uploadFileToGithub({
          file: fileBlob,
          repoPath: `pdfs/Semester${submission.semester}/Syllabus.pdf`,
          commitMessage: `Add Semester ${submission.semester} syllabus`,
        })
      } else {
        publishedUrl = await uploadFileToGithub({
          file: fileBlob,
          repoPath: buildStagingRepoPath(submission),
          commitMessage: `Add ${submission.resource_label} (Sem ${submission.semester} - ${submission.subject})`,
        })
      }
    } catch (err) {
      setActionError('Could not publish the file to the CDN: ' + err.message)
      setBusyId(null)
      return
    }

    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        status: 'approved',
        reviewed_by: session?.user?.email || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submission.id)

    if (updateError) {
      setActionError('File was published, but the submission could not be marked approved.')
      setBusyId(null)
      return
    }

    if (submission.resource_type === 'syllabus') {
      await supabase
        .from('resources')
        .update({ deleted_at: new Date().toISOString() })
        .eq('subject', submission.subject)
        .eq('semester', submission.semester)
        .eq('resource_type', 'syllabus')
    }

    let insertErrorMessage = ''
    try {
      if (submission.resource_type === 'syllabus') {
        await supabase.from('resources').insert({
          semester: submission.semester,
          subject: submission.subject,
          resource_type: submission.resource_type,
          name: 'Syllabus',
          path: publishedUrl,
          file_size_bytes: fileBlob.size,
        })
      } else if (submission.resource_type === 'semester_syllabus') {
        await supabase.from('global_resources').upsert({
          key: `syllabus_semester_${submission.semester}`,
          value: publishedUrl,
        })
      } else {
        await insertResourceOnTop({
          semester: submission.semester,
          subject: submission.subject,
          resource_type: submission.resource_type,
          name: submission.resource_label,
          path: publishedUrl,
          file_size_bytes: fileBlob.size,
        })
      }
    } catch (err) {
      insertErrorMessage = err.message
    }

    if (insertErrorMessage) {
      setActionError('Published, but could not add it to the resources list: ' + insertErrorMessage)
    } else {
      setActionMessage(`Published and live: ${submission.resource_label}`)
      notify({ variant: 'success', message: `Published and live: ${submission.resource_label}` })
    }

    await recordSubmissionContributor(submission.student_name)
    await supabase.storage.from('pending-uploads').remove([submission.file_path])

    setBusyId(null)
    fetchSubmissions()
    fetchStats()
    refreshResources()
  }

  const handleReject = async (submission, reason) => {
    setActionError('')
    setBusyId(submission.id)

    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        reviewed_by: session?.user?.email || null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq('id', submission.id)

    if (updateError) {
      setActionError('Could not reject this submission.')
      setBusyId(null)
      return
    }

    const timer = setTimeout(() => {
      rejectCleanups.current.delete(submission.id)
      supabase.storage.from('pending-uploads').remove([submission.file_path])
    }, 9000)
    rejectCleanups.current.set(submission.id, { timer, path: submission.file_path })

    setBusyId(null)
    fetchSubmissions()
    fetchStats()
    notify({
      variant: 'success',
      message: `Rejected: ${submission.resource_label}.`,
      actionLabel: 'Undo',
      duration: 8000,
      onAction: async () => {
        const entry = rejectCleanups.current.get(submission.id)
        if (!entry) {
          notify({ variant: 'error', message: 'Too late to undo this rejection.' })
          return
        }
        clearTimeout(entry.timer)
        rejectCleanups.current.delete(submission.id)
        const { error: undoError } = await supabase
          .from('submissions')
          .update({ status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null })
          .eq('id', submission.id)
        if (undoError) {
          notify({ variant: 'error', message: 'Could not undo the rejection.' })
          supabase.storage.from('pending-uploads').remove([submission.file_path])
          return
        }
        fetchSubmissions()
        fetchStats()
        notify({ variant: 'success', message: `Restored to pending: ${submission.resource_label}.` })
      },
    })
  }

  return (
    <div className="dashboard-panel">
      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-value">{pendingCount}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{approvedThisWeek}</span>
          <span className="stat-label">Approved this week</span>
        </div>
      </div>

      <div className="dashboard-filters">
        <Select
          value={semesterFilter}
          onChange={setSemesterFilter}
          options={semesters.map((sem) => ({ value: sem, label: `Semester ${sem}` }))}
          placeholder="All semesters"
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          options={RESOURCE_TYPE_OPTIONS}
          placeholder="All types"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
        />
      </div>

      {actionError && <p className="dashboard-error">{actionError}</p>}
      {actionMessage && <p className="dashboard-success">{actionMessage}</p>}

      {loading ? (
        <p className="dashboard-empty">Loading submissions...</p>
      ) : submissions.length === 0 ? (
        <p className="dashboard-empty">No submissions match these filters.</p>
      ) : (
        <>
          <div className="submission-list">
            {submissions.map((submission) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                subjects={subjects}
                onChanged={fetchSubmissions}
                onPreview={handlePreview}
                onDownload={handleDownload}
                onApprove={handleApprove}
                onReject={setRejectTarget}
                toolMeta={toolMetaById[submission.id]}
                onCompress={handleCompress}
                busy={busyId === submission.id}
                canCompress={canCompress}
                compressing={compressingId === submission.id}
              />
            ))}
          </div>
          <div className="pagination-bar">
            <button className="action-btn neutral-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </button>
            <span className="pagination-status">Page {page + 1} of {totalPages}</span>
            <button className="action-btn neutral-btn" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}

      {compressTarget && (
        <PDFToolModal
          file={compressTarget.file}
          onApply={handleApplyCompression}
          onClose={() => { setCompressTarget(null); setCompressingId(null) }}
        />
      )}

      {rejectTarget && (
        <RejectReasonModal
          label={rejectTarget.resource_label}
          onConfirm={(reason) => {
            const target = rejectTarget
            setRejectTarget(null)
            handleReject(target, reason)
          }}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}

export default SubmissionsTab