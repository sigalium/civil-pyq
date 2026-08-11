import { useCallback, useEffect, useRef, useState } from 'react'
import Select from '../../components/Select'
import { useResourcesData } from '../../context/ResourcesDataContext'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { usePDFWindows } from '../../context/PDFWindowContext'
import { buildStagingRepoPath } from '../../utils/resourceSnippet'
import { uploadFileToGithub } from '../../utils/githubUpload'
import { insertResourceOnTop } from '../../utils/resourceOrdering'
import { scanFileForMalware, checkScanStatus } from '../../utils/malwareScan'
import './Dashboard.css'

const RESOURCE_TYPES = ['pyq', 'lab', 'syllabus']
const STATUSES = ['pending', 'approved', 'rejected']
const RESOURCE_TYPE_OPTIONS = RESOURCE_TYPES.map((t) => ({ value: t, label: t }))
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

const SubmissionCard = ({ submission, subjects, onChanged, onPreview, onApprove, onReject, busy }) => {
  const [editing, setEditing] = useState(false)
  const [semester, setSemester] = useState(submission.semester)
  const [subject, setSubject] = useState(submission.subject)
  const [resourceType, setResourceType] = useState(submission.resource_type)
  const [resourceLabel, setResourceLabel] = useState(submission.resource_label)
  const [saving, setSaving] = useState(false)
  const [scan, setScan] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  const runScan = async () => {
    setScanning(true)
    setScanError('')
    setScan(null)
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
      setScan(result)
    } catch (err) {
      setScanError(err.message)
    }
    setScanning(false)
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
      <div className="submission-card">
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
        <div className="submission-actions">
          <button className="action-btn approve-btn" disabled={saving} onClick={save}>Save</button>
          <button className="action-btn reject-btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="submission-card">
      <div className="submission-info">
        <h3>{submission.resource_label}</h3>
        <p>
          Semester {submission.semester} · {submission.subject} · {submission.resource_type}
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
            <button className="action-btn preview-btn" onClick={runScan} disabled={scanning}>
              {scanning ? 'Scanning…' : 'Scan for malware'}
            </button>
            <button className="action-btn preview-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="action-btn approve-btn"
              onClick={() => onApprove(submission)}
              disabled={busy}
            >
              {busy ? 'Publishing…' : 'Approve'}
            </button>
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
      {scanError && <p className="dashboard-error">{scanError}</p>}
      {scan?.status === 'completed' && (
        <p className={scan.malicious ? 'dashboard-error' : 'dashboard-success'}>
          {scan.malicious
            ? `Flagged malicious by ${scan.stats?.malicious || 0} scan engine(s). Do not approve.`
            : scan.suspicious
              ? `Clean, but ${scan.stats?.suspicious || 0} engine(s) marked it suspicious. Worth a second look.`
              : 'Clean — no scan engine flagged this file.'}
        </p>
      )}
      {scan?.status === 'pending' && (
        <p className="dashboard-error">Scan is still running on VirusTotal — try again in a minute.</p>
      )}
    </div>
  )
}

const PAGE_SIZE = 20

const SubmissionsTab = () => {
  const { session } = useAuth()
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
  const initializedRef = useRef(false)

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

  const handleApprove = async (submission) => {
    setActionError('')
    setActionMessage('')
    setBusyId(submission.id)

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
      publishedUrl = await uploadFileToGithub({
        file: fileBlob,
        repoPath: buildStagingRepoPath(submission),
        commitMessage: `Add ${submission.resource_label} (Sem ${submission.semester} - ${submission.subject})`,
      })
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
        .delete()
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
        })
      } else {
        await insertResourceOnTop({
          semester: submission.semester,
          subject: submission.subject,
          resource_type: submission.resource_type,
          name: submission.resource_label,
          path: publishedUrl,
        })
      }
    } catch (err) {
      insertErrorMessage = err.message
    }

    if (insertErrorMessage) {
      setActionError('Published, but could not add it to the resources list: ' + insertErrorMessage)
    } else {
      setActionMessage(`Published and live: ${submission.resource_label}`)
    }

    await supabase.storage.from('pending-uploads').remove([submission.file_path])

    setBusyId(null)
    fetchSubmissions()
    fetchStats()
    refreshResources()
  }

  const handleReject = async (submission) => {
    setActionError('')
    setBusyId(submission.id)

    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        reviewed_by: session?.user?.email || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submission.id)

    if (updateError) {
      setActionError('Could not reject this submission.')
      setBusyId(null)
      return
    }

    await supabase.storage.from('pending-uploads').remove([submission.file_path])

    setBusyId(null)
    fetchSubmissions()
    fetchStats()
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
                onApprove={handleApprove}
                onReject={handleReject}
                busy={busyId === submission.id}
              />
            ))}
          </div>
          <div className="pagination-bar">
            <button className="action-btn reject-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </button>
            <span className="pagination-status">Page {page + 1} of {totalPages}</span>
            <button className="action-btn reject-btn" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default SubmissionsTab
