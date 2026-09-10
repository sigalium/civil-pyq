import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { usePDFWindows } from '../context/usePDFWindows'
import './styles/NoContent.css'

const NoContent = ({ semester, syllabusPath }) => {
  const { openPdf } = usePDFWindows();

  const handleViewSyllabus = () => {
    openPdf({ name: `Semester ${semester} - Syllabus`, path: syllabusPath });
  };

  return (
    <div className="no-content fade-in">
      <BackButton onClick={() => window.history.back()} text="Back" className="back-btn-page-top" />
      <div className="no-content-container">
        <h2>Semester {semester}</h2>
        {syllabusPath && (
          <button className="syllabus-btn" onClick={handleViewSyllabus}>
            View Semester Syllabus
          </button>
        )}
        <p className="message">
          Sorry, no content available for this semester yet. <br />
          Help us make this website better by contributing!
        </p>
        <Link to="/contribute" className="contribute-btn">
          Contribute Now
        </Link>
      </div>
    </div>
  )
}

export default NoContent