import { Close, ZoomIn, ZoomOut, Download, Remove, IosShare } from '@mui/icons-material';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useState, useEffect, useRef } from 'react';
import AIChatWidget from './AIChatWidget';
import AskGeminiButton from './AskGeminiButton';
import { logResourceEvent } from '../utils/analytics';
import './css/PDFViewer.css';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const isMobile = window.matchMedia('(max-width: 800px)').matches;

const PDFViewer = ({
  pdfName,
  pdfPath,
  resourceId,
  onClose,
  onMinimize,
  hidden = false,
  windowed = false,
  closeOnOutsideClick = true,
  isFocused = true,
  externalClosing = false,
}) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageHeight, setPageHeight] = useState(null);
  const [loadProgress, setLoadProgress] = useState(null);
  const [scale, setScale] = useState(isMobile ? 0.5 : 1.0);
  const [isClosing, setIsClosing] = useState(false);
  const [showPageIndicator, setShowPageIndicator] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const closing = isClosing || externalClosing;

  const handleClose = () => {
    setIsClosing(true);
    if (!externalClosing) setTimeout(() => { onClose(); }, 340);
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
    if (hidden) return;
    const handleClickOutside = (event) => {
      if (!closeOnOutsideClick) return;
      if (event.target.closest('.ask-gemini-btn')) return;
      
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isFullscreen) toggleFullscreen();
        else if (isFocused) handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [isFullscreen, hidden, closeOnOutsideClick, isFocused]);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShowPageIndicator(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => { setShowPageIndicator(false); }, 1500);

        if (numPages) {
          const scrollTop = contentElement.scrollTop;
          const scrollHeight = contentElement.scrollHeight;
          const pageStep = scrollHeight / numPages;
          const calculatedPage = Math.floor(scrollTop / pageStep) + 1;
          setCurrentPage((prev) => {
            const next = Math.min(Math.max(1, calculatedPage), numPages);
            return next === prev ? prev : next;
          });
        }
        ticking = false;
      });
    };

    contentElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      contentElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [numPages]);

  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 5.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

  useEffect(() => {
    setPageHeight(null);
  }, [scale]);

  const handleDownload = () => {
    if (resourceId) logResourceEvent(resourceId, 'download');
    window.open(pdfPath, '_blank', 'noopener,noreferrer');
  };

  const [shareCopied, setShareCopied] = useState(false);
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      // clipboard unavailable, silently ignore
    }
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
      <div
        className={`pdf-viewer-overlay ${closing ? 'closing' : ''} ${isFullscreen ? 'fullscreen-mode' : ''} ${hidden ? 'pdf-window-hidden' : ''} ${windowed ? 'pdf-window-mode' : ''}`}
      >
        <div 
          className={`pdf-viewer-container ${closing ? 'closing' : ''} ${isChatOpen ? 'expanded-modal' : ''}`}
          ref={modalRef}
          >
          <div className="pdf-viewer-header pdf-viewer-header-fixed">
            <h3>{pdfName}</h3>
            <div className="header-actions">
              {onMinimize && (
                <button className="minimize-btn" onClick={onMinimize} aria-label="Minimize">
                  <Remove />
                </button>
              )}
              <button className="fullscreen-header-btn" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button className="close-btn" onClick={handleClose}>
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
                    onLoadProgress={({ loaded, total }) => {
                      setLoadProgress(total > 0 ? Math.round((loaded / total) * 100) : null);
                    }}
                    loading={
                      <div className="pdf-loading-state">
                        <div className="pdf-loading-spinner" />
                        <span>{loadProgress !== null ? `Loading PDF… ${loadProgress}%` : 'Loading PDF…'}</span>
                      </div>
                    }
                  >
                    {numPages &&
                      Array.from({ length: numPages }, (_, index) => {
                        const pageNumber = index + 1;
                        const inRange = pageNumber >= currentPage - 2 && pageNumber <= currentPage + 2;
                        if (inRange) {
                          return (
                            <Page
                              key={`page_${pageNumber}`}
                              pageNumber={pageNumber}
                              scale={scale}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              loading={
                                <div className="pdf-page-loading" style={{ height: pageHeight ? `${pageHeight}px` : '842px' }}>
                                  <div className="pdf-loading-spinner small" />
                                </div>
                              }
                              onLoadSuccess={(page) => {
                                setPageHeight((prev) => prev ?? page.height);
                              }}
                            />
                          );
                        }
                        return (
                          <div
                            key={`page_${pageNumber}`}
                            style={{ height: pageHeight ? `${pageHeight}px` : '842px', marginBottom: '8px' }}
                          />
                        );
                      })}
                  </Document>
                </div>
              </div>

              <div className={`pdf-page-indicator ${showPageIndicator ? 'visible' : ''}`}>
                Page {currentPage} of {numPages || '--'}
              </div>

              <div className={`pdf-page-indicator ${shareCopied ? 'visible' : ''}`}>
                Link copied
              </div>

              <div className="pdf-viewer-controls pdf-viewer-controls-fixed">
                <button className="control-btn" onClick={handleZoomOut}><ZoomOut /></button>
                <span className="zoom-counter">{(scale * 100).toFixed(0)}%</span>
                <button className="control-btn" onClick={handleZoomIn}><ZoomIn /></button>
                <button className="control-btn download-btn" onClick={handleDownload}>
                  <Download /><span>Download</span>
                </button>
                <button className="control-btn share-btn" onClick={handleShare} aria-label="Copy link">
                  <IosShare />
                </button>
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
                  pdfContainerRef={contentRef}
                />
              </div>
            )}
          </div>
        </div>

        {!closing && !hidden && isFocused && (
          <AskGeminiButton 
            isOpen={isChatOpen} 
            onClick={() => setIsChatOpen(!isChatOpen)} 
            buttonText={aiButtonText}
            windowed={windowed}
          />
        )}
      </div>
    </>
  );
};

export default PDFViewer;