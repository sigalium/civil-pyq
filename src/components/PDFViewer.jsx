import { Close, ZoomIn, ZoomOut, Download, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import { useState, useEffect, useRef } from 'react';
import AIChatWidget from './AIChatWidget';
import AskGeminiButton from './AskGeminiButton';
import './css/PDFViewer.css';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const isMobile = window.matchMedia('(max-width: 800px)').matches;

const PDFViewer = ({ pdfName, pdfPath, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(isMobile ? 0.5 : 1.0);
  const [isClosing, setIsClosing] = useState(false);
  const [showPageIndicator, setShowPageIndicator] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const hasPushedStateRef = useRef(false);
  const prevHistoryStateRef = useRef(null);

  const handleClose = (calledFromPopstate = false) => {
    setIsClosing(true);
    if (hasPushedStateRef.current) {
      if (!calledFromPopstate) {
        try { window.history.replaceState(prevHistoryStateRef.current, '', window.location.href); } catch (e) {}
      }
      hasPushedStateRef.current = false;
    }
    setTimeout(() => { onClose(); }, 300);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (modalRef.current.requestFullscreen) modalRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      prevHistoryStateRef.current = window.history.state;
      try {
        window.history.pushState({ __pdfViewer: true }, '');
        hasPushedStateRef.current = true;
      } catch (e) {}
    }

    const handlePopState = (event) => {
      if (!hasPushedStateRef.current) return;
      hasPushedStateRef.current = false;
      if (isChatOpen && isMobile) {
          setIsChatOpen(false);
          try { window.history.pushState({ __pdfViewer: true }, ''); hasPushedStateRef.current = true; } catch (e) {}
      } else {
          handleClose(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (hasPushedStateRef.current) {
        try { window.history.replaceState(prevHistoryStateRef.current, '', window.location.href); } catch (e) {}
        hasPushedStateRef.current = false;
      }
    };
  }, [isChatOpen]);

  useEffect(() => {
    if (isMobile) setScale(0.5);
    else setScale(1.0);
    const handleClickOutside = (event) => {
      if (event.target.closest('.ask-gemini-btn')) return;
      
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isFullscreen) toggleFullscreen();
        else handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [isFullscreen]);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;
    const handleScroll = () => {
      setShowPageIndicator(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => { setShowPageIndicator(false); }, 1500);
    };

    contentElement.addEventListener('scroll', handleScroll);
    return () => {
      contentElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || !numPages) return;

    const handleScrollTrackPage = () => {
      const scrollTop = contentElement.scrollTop;
      const scrollHeight = contentElement.scrollHeight;
      const pageHeight = scrollHeight / numPages;
      const calculatedPage = Math.floor(scrollTop / pageHeight) + 1;
      setCurrentPage(Math.min(Math.max(1, calculatedPage), numPages));
    };

    contentElement.addEventListener('scroll', handleScrollTrackPage);
    return () => contentElement.removeEventListener('scroll', handleScrollTrackPage);
  }, [numPages]);

  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);
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

  const aiButtonText = 
    pdfName.toLowerCase().includes('syllabus') || 
    pdfName.toLowerCase().includes('calendar') || 
    pdfName.toLowerCase().includes('lab') || 
    pdfName.toLowerCase().includes('manual') 
      ? 'Ask AI' 
      : 'Solve PYQ';

  return (
    <>
      <div className={`pdf-viewer-overlay ${isClosing ? 'closing' : ''} ${isFullscreen ? 'fullscreen-mode' : ''}`}>
        <div 
          className={`pdf-viewer-container ${isClosing ? 'closing' : ''} ${isChatOpen ? 'expanded-modal' : ''}`}
          ref={modalRef}
          >
          <div className="pdf-viewer-header pdf-viewer-header-fixed">
            <h3>{pdfName}</h3>
            <div className="header-actions">
              <button className="close-btn" onClick={() => handleClose(false)}>
                <Close />
              </button>
            </div>
          </div>
          
          {/* Split Screen Wrapper */}
          <div className="pdf-split-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div className="pdf-main-area" style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              <div className="pdf-viewer-content pdf-viewer-content-mobile" ref={contentRef} style={{ flex: 1, overflowY: 'auto' }}>
                <div className="pdf-placeholder" style={{ padding: '20px' }}>
                  <Document
                    file={pdfPath}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div>Loading PDF...</div>}
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

              <div className={`pdf-page-indicator ${showPageIndicator ? 'visible' : ''}`}>
                Page {currentPage} of {numPages || '--'}
              </div>
              
              <div className="pdf-viewer-controls pdf-viewer-controls-fixed">
                <button className="control-btn" onClick={handleZoomOut}><ZoomOut /></button>
                <span className="zoom-counter">{(scale * 100).toFixed(0)}%</span>
                <button className="control-btn" onClick={handleZoomIn}><ZoomIn /></button>
                <button className="control-btn download-btn" onClick={handleDownload}>
                  <Download /><span>Download</span>
                </button>
                {!isMobile && (
                  <button className="control-btn fullscreen-bottom-btn" onClick={toggleFullscreen}>
                    {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                  </button>
                )}
              </div>
            </div>

            {/* AI Chat Panel */}
            {isChatOpen && (
              <div className={`ai-chat-panel ${isMobile ? 'bottom-sheet' : ''}`}>
                <AIChatWidget 
                  currentPage={currentPage} 
                  pdfName={pdfName} 
                  numPages={numPages}
                  onCloseChat={() => setIsChatOpen(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Button */}
      {!isClosing && (
        <AskGeminiButton 
          isOpen={isChatOpen} 
          onClick={() => setIsChatOpen(!isChatOpen)} 
          buttonText={aiButtonText}
        />
      )}
    </>
  );
};

export default PDFViewer;