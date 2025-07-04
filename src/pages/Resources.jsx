import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import SemesterCard from '../components/SemesterCard'
import ResourceList from '../components/ResourceList'
import PDFViewer from '../components/PDFViewer'
import NoContent from './NoContent'
import './Resources.css'
import subjects from '../data/subjects'
import resources from '../data/resources'

const semesters = [1, 2, 3, 4, 5, 6, 7, 8]

const Resources = () => {
  const { semester, subject } = useParams()
  const navigate = useNavigate()
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [selectedPdf, setSelectedPdf] = useState('')
  const [selectedPdfPath, setSelectedPdfPath] = useState('')

  const handleSemesterClick = (sem) => {
    navigate(`/resources/${sem}`)
  }

  const handleSubjectClick = (subj) => {
    navigate(`/resources/${semester}/${subj}`)
  }

  const handlePdfClick = (item) => {
    setSelectedPdf(item.name || item)
    setSelectedPdfPath(item.path || '')
    setShowPdfViewer(true)
  }

  const handleViewSyllabus = () => {
    setSelectedPdf(`${subject} Syllabus`)
    setSelectedPdfPath(`/pdfs/Semester${semester}/${subject}/Syllabus.pdf`)
    setShowPdfViewer(true)
  }

  if (semester && (semester > 2 || semester < 1)) {
    return <NoContent semester={semester} />
  }

  return (
    <div className="resources fade-in">
      <div className="resources-container">
        {!semester && (
          <div className="semester-selection">
            <h2 className="select-semester-heading">Select Semester</h2>
            <div className="semester-grid">
              {semesters.map((sem) => (
                <SemesterCard
                  key={sem}
                  semester={sem}
                  onClick={() => handleSemesterClick(sem)}
                />
              ))}
            </div>
          </div>
        )}

        {semester && !subject && (
          <div className="subject-selection">
            <BackButton onClick={() => navigate('/resources')} text="Select Semester" />
            <h2 className="semester-title">Semester {semester}</h2>
            <h3 className="select-subject-heading">Select Subject</h3>
            <div className="subject-list">
              {subjects[semester]?.map((subj) => (
                <button
                  key={subj}
                  className="subject-btn"
                  onClick={() => handleSubjectClick(subj)}
                >
                  {subj}
                </button>
              ))}
            </div>
          </div>
        )}

        {subject && (
          <div className="resource-view">
            <BackButton onClick={() => navigate(`/resources/${semester}`)} text={`Semester ${semester}`} />
            <h2 className="subject-title">{subject}</h2>
            <button className="syllabus-btn" onClick={handleViewSyllabus}>
              View Syllabus
            </button>

            <div className="resource-sections">
              <ResourceList
                title="PYQ Section"
                items={resources[subject]?.pyq || []}
                onItemClick={handlePdfClick}
              />
              <ResourceList
                title="Lab Manual & Other Resources"
                items={resources[subject]?.lab || []}
                onItemClick={handlePdfClick}
              />
            </div>
          </div>
        )}
      </div>

      {showPdfViewer && (
        <PDFViewer
          pdfName={selectedPdf}
          pdfPath={selectedPdfPath}
          onClose={() => setShowPdfViewer(false)}
        />
      )}
    </div>
  )
}

export default Resources