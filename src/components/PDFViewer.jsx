import { Close, ZoomIn, ZoomOut, Download } from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import { useState, useEffect, useRef } from 'react';
import './PDFViewer.css';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const isMobile = window.matchMedia('(max-width: 600px)').matches;

const PDFViewer = ({ pdfName, pdfPath, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(isMobile ? 0.5 : 1.0);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isMobile) setScale(0.5);
    else setScale(1.0);

    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

 
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 5.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const handleDownload = () => window.open(pdfPath, '_blank');

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className={`pdf-viewer-overlay ${isClosing ? 'closing' : ''}`}>
      <div 
        className={`pdf-viewer-container ${isClosing ? 'closing' : ''}`}
        ref={modalRef}
      >
        <div className="pdf-viewer-header">
          <h3>{pdfName}</h3>
          <button className="close-btn" onClick={handleClose}>
            <Close />
          </button>
        </div>
        <div className="pdf-viewer-content">
          <div className="pdf-placeholder" style={{ padding: '20px' }}>
            <Document
              file={pdfPath}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<p style={{ color: 'var(--text-primary)' }}>Loading PDF...</p>}
              error={<p style={{ color: 'var(--text-primary)' }}>Failed to load PDF.</p>}
            >
              {numPages &&
                Array.from({ length: numPages }, (_, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    scale={scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                ))}
            </Document>
          </div>
        </div>
        <div className="pdf-viewer-controls">
          <button className="control-btn" onClick={handleZoomOut}>
            <ZoomOut />
          </button>
          <span className="zoom-counter">
            {(scale * 100).toFixed(0)}%
          </span>
          <button className="control-btn" onClick={handleZoomIn}>
            <ZoomIn />
          </button>
          
          <button className="control-btn download-btn" onClick={handleDownload}>
            <Download />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;