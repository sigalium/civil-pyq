import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import SemesterCard from '../components/SemesterCard';
import ResourceList from '../components/ResourceList';
import PDFViewer from '../components/PDFViewer';
import AIPredictorWidget from '../components/AIPredictorWidget';
import NoContent from './NoContent';
import './styles/Resources.css';
import subjects, { electives } from '../data/subjects';
import resources from '../data/resources';
import { AutoAwesome, Close } from '@mui/icons-material'

const semesters = [1, 2, 3, 4, 5, 6, 7, 8];
const emptySemesters = [7, 8];

const Resources = () => {
  const { semester, subject } = useParams();
  const navigate = useNavigate();
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState('');
  const [selectedPdfPath, setSelectedPdfPath] = useState('');
  const [showPredictModal, setShowPredictModal] = useState(false);
  const [showPredictorWidget, setShowPredictorWidget] = useState(false);
  const [predictionPdfs, setPredictionPdfs] = useState([]);

  const handleSemesterClick = (sem) => { navigate(`/resources/${sem}`); };
  const handleSubjectClick = (subj) => { navigate(`/resources/${semester}/${subj}`); };

  const handlePdfClick = (item) => {
    setSelectedPdf(`${subject} - ${item.name || item}`);
    setSelectedPdfPath(item.path || '');
    setShowPdfViewer(true);
  };

  const handleViewSyllabus = () => {
    setSelectedPdf(`${subject} - Syllabus`);
    const hasSubjectSpecificSyllabus = resources[subject]?.syllabus === true;
    if (hasSubjectSpecificSyllabus) {
      setSelectedPdfPath(`/pdfs/Semester${semester}/${subject}/Syllabus.pdf`);
    } else {
      setSelectedPdfPath(`/pdfs/Semester${semester}/Syllabus.pdf`);
    }
    setShowPdfViewer(true);
  };

  // --- PREDICTOR LOGIC ---
  const handleStartPrediction = (yearsAmount) => {
    const pyqs = resources[subject]?.pyq || [];
    if (pyqs.length === 0) {
      alert("No PYQs available to analyze for this subject yet!");
      return;
    }
    const availableYears = pyqs
      .map(pyq => {
        const match = pyq.name.match(/20\d{2}/);
        return match ? parseInt(match[0]) : 0;
      })
      .filter(year => year > 0);
    const uniqueYears = [...new Set(availableYears)].sort((a, b) => b - a);
    const targetYears = uniqueYears.slice(0, yearsAmount);
    const filteredPdfs = pyqs.filter(pyq => {
      const match = pyq.name.match(/20\d{2}/);
      const pyqYear = match ? parseInt(match[0]) : 0;
      return targetYears.includes(pyqYear);
    });
    const finalPdfs = filteredPdfs.length > 0 ? filteredPdfs : pyqs.slice(0, yearsAmount * 2);

    setPredictionPdfs(finalPdfs);
    setShowPredictModal(false);
    setShowPredictorWidget(true);
  };

  if (semester && emptySemesters.includes(Number(semester))) {
    return <NoContent semester={semester} />;
  }

  return (
    <div className="resources fade-in">
      <div className="resources-container">
        
        {!semester && (
          <div className="semester-selection">
            <h2 className="select-semester-heading">Select Semester</h2>
            <div className="semester-grid">
              {semesters.map((sem) => (
                <SemesterCard key={sem} semester={sem} onClick={() => handleSemesterClick(sem)} />
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
                {subjects[semester]?.map((subj) => {
                  const isElective = electives.includes(subj);
                  return (
                    <button
                      key={subj}
                      className={`subject-btn ${isElective ? 'elective-glass' : ''}`}
                      onClick={() => handleSubjectClick(subj)}
                    >
                      {subj}
                      {isElective && <span className="elective-badge">Elective</span>}
                    </button>
                  );
                })}
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
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>PYQ Section</span>
                    {resources[subject]?.pyq?.length > 0 && (
                      <button 
                        onClick={() => setShowPredictModal(true)}
                        style={{
                          background: 'rgba(138, 180, 248, 0.1)', color: '#8ab4f8', border: '1px solid rgba(138, 180, 248, 0.3)',
                          padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                          fontWeight: '600', fontSize: '0.85rem', transition: 'all 0.2s', fontFamily: 'inherit'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#8ab4f8'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(138, 180, 248, 0.1)'; e.currentTarget.style.color = '#8ab4f8'; }}
                      >
                        <AutoAwesome sx={{ fontSize: 16 }} /> Predict Paper
                      </button>
                    )}
                  </div>
                }
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
        <PDFViewer pdfName={selectedPdf} pdfPath={selectedPdfPath} onClose={() => setShowPdfViewer(false)} />
      )}

      {/* --- PREDICTOR SELECTION MODAL --- */}
      {showPredictModal && (
        <div className="custom-modal-overlay" style={{ zIndex: 300 }}>
          <div className="custom-modal" style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPredictModal(false)} className="close-btn">
                <Close />
              </button>
            </div>
            <div className="modal-icon-wrapper" style={{ background: 'rgba(138, 180, 248, 0.1)', color: '#8ab4f8' }}>
              <AutoAwesome sx={{ fontSize: 32 }} />
            </div>
            <h4>AI Exam Predictor</h4>
            <p>How many years of past papers should the AI analyze to predict trends?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => handleStartPrediction(1)} className="modal-btn predictor-option-btn" >Last 1 Year</button>
              <button onClick={() => handleStartPrediction(2)} className="modal-btn predictor-option-btn" >Last 2 Years</button>
              <button onClick={() => handleStartPrediction(3)} className="modal-btn predictor-option-btn recommended" >Last 3 Years (Recommended)</button>
            </div>
          </div>
        </div>
      )}

      {showPredictorWidget && (
        <div className="pdf-viewer-overlay">
          <div className="pdf-viewer-container">
            <AIPredictorWidget 
              subject={subject} 
              pdfList={predictionPdfs} 
              onClose={() => setShowPredictorWidget(false)} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Resources;