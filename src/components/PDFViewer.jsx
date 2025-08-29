import { Close, ZoomIn, ZoomOut, Download, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import { useState, useEffect, useRef } from 'react';
import './css/PDFViewer.css';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const isMobile = window.matchMedia('(max-width: 600px)').matches;

const PDFViewer = ({ pdfName, pdfPath, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(isMobile ? 0.5 : 1.0);
  const [isClosing, setIsClosing] = useState(false);
  const [showPageIndicator, setShowPageIndicator] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const closedByPopState = useRef(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (modalRef.current.requestFullscreen) {
        modalRef.current.requestFullscreen();
      } else if (modalRef.current.webkitRequestFullscreen) {
        modalRef.current.webkitRequestFullscreen();
      } else if (modalRef.current.msRequestFullscreen) {
        modalRef.current.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

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
        if (isFullscreen) {
          toggleFullscreen();
        } else {
          handleClose();
        }
      }
      
      // 'F' key for toggling fullscreen
      if (!isMobile && (event.key === 'f' || event.key === 'F')) {
        toggleFullscreen();
        event.preventDefault();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isFullscreen]);

  // Handle scroll events to show/hide page indicator
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const handleScroll = () => {
      setShowPageIndicator(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        setShowPageIndicator(false);
      }, 1500);
    };

    contentElement.addEventListener('scroll', handleScroll);
    
    return () => {
      contentElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Track current page based on scroll position
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || !numPages) return;

    const handleScrollTrackPage = () => {
      const scrollTop = contentElement.scrollTop;
      const scrollHeight = contentElement.scrollHeight;
      const pageHeight = scrollHeight / numPages;
      const currentPage = Math.floor(scrollTop / pageHeight) + 1;
      
      setCurrentPage(Math.min(Math.max(1, currentPage), numPages));
    };

    contentElement.addEventListener('scroll', handleScrollTrackPage);
    
    return () => {
      contentElement.removeEventListener('scroll', handleScrollTrackPage);
    };
  }, [numPages]);

  // mobile back button handling
  useEffect(() => {
    if (!isMobile) return;

    window.history.pushState({ pdfModal: true }, '');

    const handlePopState = () => {
      handleClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!isClosing) {
        window.history.back();
      }
    };
  }, [isClosing]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 5.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfPath;
    link.download = pdfName || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`pdf-viewer-overlay ${isClosing ? 'closing' : ''} ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      <div 
        className={`pdf-viewer-container ${isClosing ? 'closing' : ''}`}
        ref={modalRef}
      >
        <div className="pdf-viewer-header pdf-viewer-header-fixed">
          <h3>{pdfName}</h3>
          <div className="header-actions">
            <button className="close-btn" onClick={handleClose}>
              <Close />
            </button>
          </div>
        </div>
        <div 
          className="pdf-viewer-content pdf-viewer-content-mobile"
          ref={contentRef}
        >
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
        
        {/* Page Indicator */}
        <div className={`pdf-page-indicator ${showPageIndicator ? 'visible' : ''}`}>
          Page {currentPage} of {numPages || '--'}
        </div>
        
          <div className="pdf-viewer-controls pdf-viewer-controls-fixed">
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
              
              {/* Fullscreen Button */}
              {!isMobile && (
                <button 
                    className="control-btn fullscreen-bottom-btn" 
                    onClick={toggleFullscreen} 
                    title="Toggle Fullscreen (F)"
                  >
                    {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                </button>
            )}
          </div>
      </div>
    </div>
  );
};

export default PDFViewer;