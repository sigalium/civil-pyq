import { useEffect, useRef, useState } from 'react'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import './styles/Contribute.css'
import { useContributorsData } from '../context/useContributorsData'
import { useResourcesData } from '../context/useResourcesData'
import { supabase } from '../lib/supabaseClient'
import { getLocalId } from '../utils/localId'
import TurnstileWidget from '../components/TurnstileWidget'
import Select from '../components/Select'
import { buildContributorPhotoUrl } from '../utils/resourceSnippet'
import { SITE_LINKS } from '../data/appData'

const RESOURCE_TYPES = [
  { value: 'pyq', label: 'Previous Year Question' },
  { value: 'lab', label: 'Lab Manual / Notes' },
  { value: 'syllabus', label: 'Subject Syllabus' },
  { value: 'semester_syllabus', label: 'Semester Syllabus' },
  { value: 'other', label: 'Other (IS Codes, NBC, IRC, etc.)' },
]

const GCU_OPTIONS = [
  { value: 'yes', label: 'Yes, GCU student' },
  { value: 'no', label: 'Others' },
]

const STATUS_LABELS = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
}

const Contribute = () => {
  const { subjects, loading: resourcesLoading, submissionIntakeEnabled } = useResourcesData()
  const { contributorRows } = useContributorsData()
  const SEMESTERS = Object.keys(subjects)
    .filter((key) => subjects[key])
    .map(Number)
    .sort((a, b) => a - b)
  const SEMESTER_OPTIONS = SEMESTERS.map((sem) => ({ value: sem, label: `Semester ${sem}` }))

  const [semester, setSemester] = useState('')
  const [subject, setSubject] = useState('')
  const [resourceType, setResourceType] = useState('pyq')
  const [resourceLabel, setResourceLabel] = useState('')
  const [studentName, setStudentName] = useState('')
  const [isGcuStudent, setIsGcuStudent] = useState(true)
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [institution, setInstitution] = useState('')
  const [uploaderSemester, setUploaderSemester] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [mySubmissions, setMySubmissions] = useState([])
  const [mySubmissionsPage, setMySubmissionsPage] = useState(0)
  const [mySubmissionsTotal, setMySubmissionsTotal] = useState(0)
  const fileInputRef = useRef(null)
  const MY_SUBMISSIONS_PAGE_SIZE = 5

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const localId = getLocalId()
    if (!localId) return
    let isMounted = true

    const from = mySubmissionsPage * MY_SUBMISSIONS_PAGE_SIZE
    const to = from + MY_SUBMISSIONS_PAGE_SIZE - 1

    supabase
      .from('submissions')
      .select('id, resource_label, subject, status, created_at', { count: 'exact' })
      .eq('local_id', localId)
      .order('created_at', { ascending: false })
      .range(from, to)
      .then(({ data, count }) => {
        if (isMounted) {
          if (data) setMySubmissions(data)
          setMySubmissionsTotal(count || 0)
        }
      })

    return () => {
      isMounted = false
    }
  }, [submitSuccess, mySubmissionsPage])

  useEffect(() => {
    if (submitSuccess) setMySubmissionsPage(0)
  }, [submitSuccess])

  const openWhatsApp = () => {
    window.open(SITE_LINKS.whatsappGroup, '_blank')
  }

  const availableSubjects = semester && subjects[semester] ? subjects[semester] : []
  const subjectOptions = availableSubjects.map((subj) => ({ value: subj, label: subj }))
  const needsSubject = resourceType === 'pyq' || resourceType === 'lab' || resourceType === 'syllabus'
  const needsSemester = resourceType !== 'other'
  const labelPlaceholder = resourceType === 'other'
    ? 'e.g. NBC 2016, IS 456:2000'
    : resourceType === 'semester_syllabus'
      ? 'e.g. Semester 3 Syllabus'
      : 'e.g. ESE Dec 2025'

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    const dropped = event.dataTransfer.files?.[0]
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped)
    } else if (dropped) {
      setSubmitError('Only PDF files are accepted.')
    }
  }

  const resetForm = () => {
    setSemester('')
    setSubject('')
    setResourceType('pyq')
    setResourceLabel('')
    setStudentName('')
    setEnrollmentNo('')
    setInstitution('')
    setUploaderSemester('')
    setFile(null)
    setTurnstileToken('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!resourceLabel.trim() || !file) {
      setSubmitError('Please add a label and attach a PDF.')
      return
    }
    if (needsSemester && !semester) {
      setSubmitError('Please select a semester.')
      return
    }
    if (needsSubject && !subject) {
      setSubmitError('Please select a subject.')
      return
    }
    if (file.type !== 'application/pdf') {
      setSubmitError('Only PDF files are accepted.')
      return
    }
    if (!uploaderSemester) {
      setSubmitError('Please select which semester you are currently in.')
      return
    }
    if (isGcuStudent && !enrollmentNo.trim()) {
      setSubmitError('Enrollment number is required for GCU students.')
      return
    }
    if (!turnstileToken) {
      setSubmitError('Please complete the verification check.')
      return
    }

    const localId = getLocalId()
    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke('submit-resource', {
        body: {
          turnstileToken,
          honeypot,
          local_id: localId,
          student_name: studentName.trim() || null,
          is_gcu_student: isGcuStudent,
          enrollment_no: isGcuStudent ? enrollmentNo.trim() : null,
          institution: !isGcuStudent ? institution.trim() || null : null,
          uploader_semester: Number(uploaderSemester),
          semester: semester ? Number(semester) : null,
          subject: needsSubject ? subject : null,
          resource_type: resourceType,
          resource_label: resourceLabel.trim(),
          file_name: file.name,
        },
      })

      if (error) {
        let message = 'Something went wrong. Please try again.'
        if (error.context && typeof error.context.json === 'function') {
          const body = await error.context.json().catch(() => null)
          if (body?.error) message = body.error
        }
        throw new Error(message)
      }
      if (data?.error) throw new Error(data.error)

      const { error: uploadError } = await supabase.storage
        .from('pending-uploads')
        .uploadToSignedUrl(data.path, data.token, file)

      if (uploadError) throw uploadError

      setSubmitSuccess(true)
      resetForm()
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const studentContributors = contributorRows.filter((c) => c.role_type === 'student' && !c.deleted_at)
  const facultyContributors = contributorRows.filter((c) => c.role_type === 'faculty' && !c.deleted_at)

  return (
    <div className="contribute fade-in">
      <div className="contribute-container">
        <section className="contribute-card">
          <div className="contribute-hero">
            <h1>Want to be a contributor?</h1>
            <p className="subtitle">
              Love helping others? Join us in making a difference!
              Contribute to our growing collection and support students like you.
            </p>
            <p className="perks">Bonus: A special spot for you on our contributors page! 💖🌟</p>
          </div>

          {!submissionIntakeEnabled ? (
            <div className="upload-success">
              <p>We're not accepting new submissions right now. Check back soon.</p>
            </div>
          ) : submitSuccess ? (
            <div className="upload-success">
              <CheckCircleIcon sx={{ fontSize: 52, color: 'var(--accent)' }} />
              <h2>Thanks!</h2>
              <p>It will show up on this page once approved.</p>
              <button className="contribute-btn-main upload-success-btn" onClick={() => setSubmitSuccess(false)}>
                Submit another
              </button>
            </div>
          ) : (
            <form className="upload-form" onSubmit={handleSubmit}>
              <h2>Upload a resource</h2>

              <input
                type="text"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="honeypot-field"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              <div className="upload-form-section">
                <h3 className="upload-form-section-title">About you</h3>
                <div className="upload-form-grid">
                  <label className="upload-field">
                    <span>Are you from GCU?</span>
                    <Select
                      value={isGcuStudent ? 'yes' : 'no'}
                      onChange={(v) => setIsGcuStudent(v === 'yes')}
                      options={GCU_OPTIONS}
                    />
                  </label>

                  {isGcuStudent ? (
                    <label className="upload-field">
                      <span>Enrollment No.</span>
                      <input
                        type="text"
                        placeholder="Required"
                        value={enrollmentNo}
                        onChange={(e) => setEnrollmentNo(e.target.value)}
                        required
                      />
                    </label>
                  ) : (
                    <label className="upload-field">
                      <span>Your institution</span>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                      />
                    </label>
                  )}

                  <label className="upload-field">
                    <span>Your current semester</span>
                    <Select
                      value={uploaderSemester}
                      onChange={setUploaderSemester}
                      options={[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => ({ value: sem, label: `Semester ${sem}` }))}
                      placeholder="Select semester"
                    />
                  </label>

                  <label className="upload-field">
                    <span>Your name (optional, for credit)</span>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="upload-form-section">
                <h3 className="upload-form-section-title">What you're uploading</h3>
                <div className="upload-form-grid">
                  <label className="upload-field">
                    <span>Resource type</span>
                    <Select value={resourceType} onChange={(v) => { setResourceType(v); setSubject('') }} options={RESOURCE_TYPES} />
                  </label>

                  <label className="upload-field">
                    <span>Resource's semester{!needsSemester ? ' (not needed)' : ''}</span>
                    <Select
                      value={semester}
                      onChange={(v) => { setSemester(v); setSubject('') }}
                      options={SEMESTER_OPTIONS}
                      placeholder={resourcesLoading ? 'Loading...' : needsSemester ? 'Select semester' : 'Not needed for this type'}
                      disabled={resourcesLoading || !needsSemester}
                    />
                  </label>

                  {needsSubject && (
                    <label className="upload-field">
                      <span>Subject</span>
                      <Select
                        value={subject}
                        onChange={setSubject}
                        options={subjectOptions}
                        placeholder="Select subject"
                        disabled={!semester}
                      />
                    </label>
                  )}

                  <label className="upload-field upload-field-wide">
                    <span>Label</span>
                    <input
                      type="text"
                      placeholder={labelPlaceholder}
                      value={resourceLabel}
                      onChange={(e) => setResourceLabel(e.target.value)}
                      required
                    />
                  </label>
                </div>

                <div
                  className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    hidden
                  />
                  {file ? (
                    <p>📄 {file.name}</p>
                  ) : (
                    <p>Drag & drop a PDF here, or click to choose one</p>
                  )}
                </div>
              </div>

              <div className="upload-form-footer">
                <TurnstileWidget
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken('')}
                />

                {submitError && <p className="upload-error">{submitError}</p>}

                <button className="contribute-btn-main" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Uploading...' : '🚀 Submit'}
                </button>

                <button type="button" className="whatsapp-secondary" onClick={openWhatsApp}>
                  💬 Prefer to send it directly?
                </button>
              </div>
            </form>
          )}

          {mySubmissions.length > 0 && (
            <div className="my-submissions">
              <h3>My submissions</h3>
              <div className="my-submissions-list">
                {mySubmissions.map((item) => (
                  <div className="my-submission-item" key={item.id}>
                    <span className="my-submission-label">{item.resource_label}</span>
                    <span className={`my-submission-status status-${item.status}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                ))}
              </div>
              {mySubmissionsTotal > MY_SUBMISSIONS_PAGE_SIZE && (
                <div className="my-submissions-pagination">
                  <button
                    className="my-submissions-page-btn"
                    disabled={mySubmissionsPage === 0}
                    onClick={() => setMySubmissionsPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="my-submissions-page-status">
                    Page {mySubmissionsPage + 1} of {Math.max(1, Math.ceil(mySubmissionsTotal / MY_SUBMISSIONS_PAGE_SIZE))}
                  </span>
                  <button
                    className="my-submissions-page-btn"
                    disabled={(mySubmissionsPage + 1) * MY_SUBMISSIONS_PAGE_SIZE >= mySubmissionsTotal}
                    onClick={() => setMySubmissionsPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="contributors-section">
          <h2>Our Student Contributors</h2>
          <div className="contributors-grid">
            {studentContributors.map((contributor) => (
              <div
                key={contributor.id}
                className={`contributor-card ${contributor.is_top_contributor ? 'top-contributor-glow' : ''}`}
              >
                {contributor.is_top_contributor && (
                  <div className="top-contributor-tag">
                    <span>👑</span> Top Contributor
                  </div>
                )}

                <div className="contributor-pfp">
                  {contributor.profile_pic ? (
                    <img src={buildContributorPhotoUrl(contributor.profile_pic)} alt={contributor.name} className="pfp-img" />
                  ) : (
                    <span className="pfp-placeholder">{contributor.name.charAt(0)}</span>
                  )}
                </div>
                <h3>{contributor.name}</h3>
                <p>Batch of {contributor.batch_year}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="contributors-section">
          <h2>Our Faculty Contributors</h2>
          <div className="contributors-grid">
            {facultyContributors.map((faculty) => (
              <div key={faculty.id} className="contributor-card">
                <div className="contributor-pfp">
                  {faculty.profile_pic ? (
                    <img src={buildContributorPhotoUrl(faculty.profile_pic)} alt={faculty.name} className="pfp-img" />
                  ) : (
                    <span className="pfp-placeholder">{faculty.name.charAt(0)}</span>
                  )}
                </div>
                <h3>{faculty.name}</h3>
                <p>{faculty.department}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Contribute
