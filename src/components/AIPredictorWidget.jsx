import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { Send, Key, PlayCircleOutline, AutoAwesome, ExpandMore, ExpandLess, ContentCopy, Check, 
         Reply, Download, Edit, Close, Description, MoreVert, DeleteOutline, Logout, DeleteForever, KeyboardArrowDown } from '@mui/icons-material';
import './css/AIPredictorWidget.css';
import { pdfjs } from 'react-pdf';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { createSecureId } from '../utils/secureId';


pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const GEMINI_MODEL = 'gemini-3.5-flash';

const cleanLatexForDownload = (rawText) => {
    let text = rawText;
    text = text.replace(/\$\$/g, '');
    text = text.replace(/\$/g, '');
    text = text.replace(/\\text\{([^}]+)\}/g, '$1');
    text = text.replace(/\\mathrm\{([^}]+)\}/g, '$1');
    text = text.replace(/\\left/g, '');
    text = text.replace(/\\right/g, '');
    text = text.replace(/\\limits/g, ''); 
    text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)');
    text = text.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
    const symbolMap = {
      // Greek Lowercase
      '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
      '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
      '\\theta': 'θ', '\\vartheta': 'θ', '\\iota': 'ι', '\\kappa': 'κ',
      '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ',
      '\\pi': 'π', '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ',
      '\\upsilon': 'υ', '\\phi': 'φ', '\\varphi': 'φ', '\\chi': 'χ',
      '\\psi': 'ψ', '\\omega': 'ω',

      // Greek Uppercase
      '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
      '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
      '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',

      // Calculus & Operations
      '\\partial': '∂', '\\nabla': '∇', '\\int': '∫', '\\iint': '∬',
      '\\sum': 'Σ', '\\prod': 'Π', '\\pm': '±', '\\mp': '∓',
      '\\times': '×', '\\cdot': '·', '\\div': '÷',

      // Relations, Geometry & Logic
      '\\approx': '≈', '\\neq': '≠', '\\leq': '≤', '\\geq': '≥',
      '\\equiv': '≡', '\\propto': '∝', '\\infty': '∞',
      '\\therefore': '∴', '\\because': '∵', '\\angle': '∠',
      '\\circ': '°', '\\degree': '°', '\\prime': '′'
    };
    for (const [latex, realChar] of Object.entries(symbolMap)) {
      text = text.split(latex).join(realChar);
    }
    const mathFuncs = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot', 'ln', 'log', 'max', 'min', 'lim'];
    mathFuncs.forEach(func => {
      text = text.split(`\\${func}`).join(func);
    });
    text = text.replace(/\^\{([^}]+)\}/g, '^$1');
    text = text.replace(/_\{([^}]+)\}/g, '_$1');
    text = text.replace(/[{}]/g, '');
    text = text.replace(/\^\{([^}]+)\}/g, '^$1');
    text = text.replace(/_\{([^}]+)\}/g, '$1');
    text = text.replace(/_([a-zA-Z0-9])/g, '$1');

    return text;
  };

const AIPredictorWidget = ({ subject, pdfList, onClose }) => {
  const instanceId = useId();
  const [apiKey, setApiKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isCrunchingPdfs, setIsCrunchingPdfs] = useState(true); 
  const [pdfProgress, setPdfProgress] = useState({ done: 0, total: 0 });
  const [extractedImages, setExtractedImages] = useState([]);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isSessionOnly, setIsSessionOnly] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);
  const [showRemoveKeyModal, setShowRemoveKeyModal] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const videoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);

  const renderedMessages = useMemo(() => {
    return messages.map((msg, i) => (
      <div key={msg.id || i} id={`msg-${instanceId}-${msg.id || i}`} className={`message-wrapper ${msg.role}`}>
        <div className="message-content-group">          
          <div className={`bubble-actions-row ${msg.role}`}>        
            <div id={`bubble-${instanceId}-${msg.id || i}`} className={`message-bubble ${msg.role}`}>
              {msg.replyTo && (
                <div 
                  className="in-bubble-reply-box" 
                  onClick={() => scrollToMessage(msg.replyTo.id)}
                >
                  <div className="reply-box-name">
                    {msg.replyTo.role === 'ai' ? 'Gemini' : 'You'}
                  </div>
                  <div className="reply-box-text">
                    {msg.replyTo.text.replace(/[*#|$`]/g, '').replace(/\n/g, ' ')}
                  </div>
                </div>
              )}

              {msg.role === 'ai' ? (
                <ReactMarkdown 
                  remarkPlugins={[remarkMath, remarkGfm]} 
                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                >
                  {msg.text}
                </ReactMarkdown>
              ) : (
                msg.text
              )}
            </div>
            
            <div className={`action-menu icon-only-bar ${msg.role} ${activeMessageMenu === i ? 'force-show' : ''}`}>
              <button onClick={() => handleCopy(msg.text, i)} className="action-icon-btn" title="Copy text">
                {copiedIndex === i ? <Check sx={{ fontSize: 14, color: '#43e6c2' }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
              </button>
              <button onClick={() => setReplyToMsg(msg)} className="action-icon-btn" title="Reply to this">
                <Reply sx={{ fontSize: 14 }} />
              </button>

              <div style={{ position: 'relative', display: 'flex' }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMessageMenu(activeMessageMenu === i ? null : i);
                    setDeleteConfirmIndex(null);
                  }} 
                  className={`action-icon-btn more-actions-trigger ${activeMessageMenu === i ? 'active' : ''}`} 
                  title="More actions"
                >
                  <MoreVert sx={{ fontSize: 14 }} />
                </button>

                {activeMessageMenu === i && (
                  <div className="message-action-dropdown">
                    {msg.role === 'user' && (
                      <button onClick={() => { handleEdit(msg.text); setActiveMessageMenu(null); }} className="msg-dropdown-item">
                        <Edit sx={{ fontSize: 14 }} /> Edit Message
                      </button>
                    )}
                    {msg.role === 'ai' && (
                      <>
                        <button onClick={() => { handleDownload(msg.text); setActiveMessageMenu(null); }} className="msg-dropdown-item">
                          <Download sx={{ fontSize: 14 }} /> Download as .txt
                        </button>
                        <button onClick={() => { handleDownloadPDF(msg.id || i); setActiveMessageMenu(null); }} className="msg-dropdown-item">
                          <Download sx={{ fontSize: 14, color: '#f28b82' }} /> Download as .pdf
                        </button>
                      </>
                    )}
                    
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerDelete(i); }} 
                      className={`msg-dropdown-item delete-btn ${deleteConfirmIndex === i ? 'confirm-state' : ''}`}
                    >
                      {deleteConfirmIndex === i ? (
                        <><DeleteForever sx={{ fontSize: 14 }} /> Tap to confirm</>
                      ) : (
                        <><DeleteOutline sx={{ fontSize: 14 }} /> Delete</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    ));
  }, [messages, copiedIndex, activeMessageMenu, deleteConfirmIndex, instanceId]);


  // --- PDF ENGINE ---
  useEffect(() => {
    if (!isKeySaved || !isCrunchingPdfs || pdfList.length === 0) return;

    const processPdfs = async () => {
      try {
        const allImages = [];
        let processedPdfs = 0;
        setPdfProgress({ done: 0, total: pdfList.length });

        for (const pdf of pdfList) {
          const loadingTask = pdfjs.getDocument(pdf.path);
          const pdfDoc = await loadingTask.promise;

          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            allImages.push({
              inlineData: { data: base64Data, mimeType: 'image/jpeg' }
            });
          }
          processedPdfs++;
          setPdfProgress({ done: processedPdfs, total: pdfList.length });
        }

        setExtractedImages(allImages);
        setIsCrunchingPdfs(false);
        triggerInitialAnalysis(allImages);

      } catch (error) {
        console.error("Error crunching PDFs:", error);
        setMessages([{ role: 'ai', text: `❌ Failed to read PDFs: ${error.message}` }]);
        setIsCrunchingPdfs(false);
      }
    };

    processPdfs();
  }, [isKeySaved, isCrunchingPdfs, pdfList]);

  const triggerInitialAnalysis = async (images) => {
    setIsLoading(true);
    const initUserId = 'init-user-' + Date.now();
    setMessages([{ id: initUserId, role: 'user', text: "Analyze these past papers and provide a master blueprint." }]);
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: "You are an expert Civil Engineering Exam Predictor. Always use standard markdown and LaTeX ($ and $$). When generating tables, use strict Markdown syntax: You MUST include the header separator row (e.g., |---|---|). NEVER put newlines or line breaks inside table rows or cells. Always leave a blank line before and after the table." }] },
          contents: [{ role: 'user', parts: [{ text: `Generate a Master Blueprint for ${subject} based on these attached papers.` }, ...images] }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const initAiId = 'init-ai-' + Date.now();
      setMessages(prev => [...prev, { id: initAiId, role: 'ai', text: data.candidates[0].content.parts[0].text }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: 'init-err', role: 'ai', text: `API Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        if (!event.target.closest('.custom-modal-overlay')) {
          setIsHeaderMenuOpen(false);
        }
      }
      if (activeMessageMenu !== null && !event.target.closest('.message-action-dropdown') && !event.target.closest('.more-actions-trigger')) {
        setActiveMessageMenu(null);
        setDeleteConfirmIndex(null);
      }
    };   
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHeaderMenuOpen, activeMessageMenu]);


  const handlePlayVideo = () => {
    setIsVideoPlaying(true);
    if (videoRef.current) {
      videoRef.current.play();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToMessage = (msgId) => {
    const element = document.getElementById(`msg-${instanceId}-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-pulse');
      setTimeout(() => element.classList.remove('highlight-pulse'), 1500);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const shouldShow = distanceToBottom > 150;
    if (showScrollButton !== shouldShow) {
      setShowScrollButton(shouldShow);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key') || sessionStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setIsKeySaved(true);
      const secureId = createSecureId(savedKey);
      const savedMessages = localStorage.getItem(`predictor_${subject}_${secureId}`);
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      } else {
        setMessages([{ 
          role: 'ai', 
          text: `Hi! I'm ready to predict exam trends for ${subject}. I have received ${pdfList.length} past papers.` 
        }]);
      }
    }
  }, [subject, pdfList]);

  useEffect(() => {
    if (messages.length > 0 && isKeySaved && apiKey) {
      const secureId = createSecureId(apiKey);
      localStorage.setItem(`predictor_${subject}_${secureId}`, JSON.stringify(messages));
    }
  }, [messages, subject, isKeySaved, apiKey]);

  const handleClosePredictor = () => {
    if (apiKey) {
      const secureId = createSecureId(apiKey);
      localStorage.removeItem(`predictor_${subject}_${secureId}`);
    }
    if (onClose) onClose();
  };

  const handleSaveKey = () => {
    const currentKey = apiKey.trim();
    
    if (currentKey.length > 20) {
      if (isSessionOnly) {
        sessionStorage.setItem('gemini_api_key', currentKey);
      } else {
        localStorage.setItem('gemini_api_key', currentKey);
      }
      setIsKeySaved(true);
      const secureId = createSecureId(currentKey);
      const savedMessages = localStorage.getItem(`predictor_${subject}_${secureId}`);
      
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      } else {
        setMessages([{ 
          role: 'ai', 
          text: `Key saved! I'm ready to predict exam trends for ${subject}. I have received ${pdfList?.length || 0} past papers.` 
        }]);
      }
    } else {
      alert("Please enter a valid Google Gemini API Key.");
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    sessionStorage.removeItem('gemini_api_key');
    setApiKey('');
    setIsKeySaved(false);
    setTermsAccepted(false);
    setShowRemoveKeyModal(false);
    setIsHeaderMenuOpen(false);
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = (text) => {
    const readableText = cleanLatexForDownload(text);
    const element = document.createElement("a");
    const file = new Blob([readableText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${subject}_Prediction.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleEdit = (text) => {
    setUserInput(text);
    setReplyToMsg(null); 
  };

  const handleDownloadPDF = async (msgId) => {
    try {
      const element = document.getElementById(`bubble-${instanceId}-${msgId}`);
      if (!element) return;
      const canvas = await html2canvas(element, {
        scale: 1,
        useCORS: true,
        backgroundColor: '#0a192f'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.5);
      const pdfWidth = canvas.width;
      const pdfHeight = canvas.height;
      
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [pdfWidth, pdfHeight],
        compress: true
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const cleanName = subject || 'Predictor';
      pdf.save(`${cleanName}_AI_Solution.pdf`);
      
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const handleDownloadFullChat = async () => {
    try {
      const element = chatMessagesRef.current;
      if (!element) return;
      const canvas = await html2canvas(element, {
        scale: 1.0,
        useCORS: true,
        backgroundColor: '#0a192f',
        height: element.scrollHeight,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedChat = clonedDoc.querySelector('.chat-messages');
          if (clonedChat) {
            clonedChat.style.height = 'auto';
            clonedChat.style.maxHeight = 'none';
            clonedChat.style.overflow = 'visible';
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.5);
      const pdfWidth = canvas.width;
      const pdfHeight = canvas.height;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [pdfWidth, pdfHeight],
        compress: true
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      
      const fileName = `${subject || 'Predictor'}_Full_History.pdf`;

      pdf.save(fileName);
      setIsHeaderMenuOpen(false);
      
    } catch (error) {
      console.error("Full PDF generation error:", error);
      alert("Failed to capture full chat. Please try again.");
    }
  };

  const triggerDelete = (index) => {
    if (deleteConfirmIndex === index) {
      handleDeleteMessage(index);
      setDeleteConfirmIndex(null);
      setActiveMessageMenu(null);
    } else {
      setDeleteConfirmIndex(index);
      setTimeout(() => setDeleteConfirmIndex(null), 3000); 
    }
  };

  const handleDeleteMessage = (indexToDelete) => {
    setMessages(prev => prev.filter((_, index) => index !== indexToDelete));
    setReplyToMsg(null); 
  };



  const handleSendMessage = async (e, quickPrompt = null) => {

    if (e) e.preventDefault();
    const textToSend = quickPrompt || userInput;
    if (!textToSend.trim() || isLoading) return;
    const currentReply = replyToMsg;
    setReplyToMsg(null);

    const newUserId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    setMessages(prev => [...prev, { 
      id: newUserId,
      role: 'user', 
      text: textToSend,
      replyTo: currentReply ? { 
        id: currentReply.id !== undefined ? currentReply.id : messages.indexOf(currentReply), 
        role: currentReply.role, 
        text: currentReply.text 
      } : null 
    }]);
    
    setUserInput('');
    setIsLoading(true);

    try {
      const chatHistory = messages.map((msg, index) => {
        if (index === 0 && msg.role === 'user') {
          return { role: 'user', parts: [{ text: msg.text }, ...extractedImages] };
        }
        return { role: msg.role === 'ai' ? 'model' : 'user', parts: [{ text: msg.text }] };
      });
      
      let contextAddition = "";
      if (currentReply) contextAddition = `\n\n[Context: Answering regarding: "${currentReply.text}"]\n`;
      
      chatHistory.push({ role: 'user', parts: [{ text: contextAddition + textToSend }] });
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: "You are an expert Civil Engineering Exam Predictor. Always format equations in LaTeX ($ and $$)." }] },
          contents: chatHistory
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      let answer = data.candidates[0].content.parts[0].text;
      answer = answer.replace(/\n{3,}/g, '\n\n');
      answer = answer.trim();
      
      const newAiId = Date.now().toString(36) + Math.random().toString(36).substring(2);
      setMessages(prev => [...prev, { id: newAiId, role: 'ai', text: answer }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'ai', text: `API Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }

  };

  if (isKeySaved && isCrunchingPdfs) {
    const percent = pdfProgress.total > 0 ? Math.round((pdfProgress.done / pdfProgress.total) * 100) : 0
    const circumference = 2 * Math.PI * 52

    return (
      <div className="ai-setup-container fade-in">
        <div className="setup-header">
          <AutoAwesome className="setup-icon" />
          <h3>Reading past papers…</h3>
        </div>
        <div className="setup-info-block">
          <div className="predictor-loader">
            <svg viewBox="0 0 120 120" className="predictor-loader-ring">
              <circle className="predictor-loader-track" cx="60" cy="60" r="52" />
              <circle
                className="predictor-loader-progress"
                cx="60"
                cy="60"
                r="52"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: circumference - (circumference * percent) / 100,
                }}
              />
            </svg>
            <div className="predictor-loader-center">
              <span className="predictor-loader-percent">{percent}%</span>
              <span className="predictor-loader-label">
                {pdfProgress.total > 0 ? `${pdfProgress.done}/${pdfProgress.total} papers` : 'starting'}
              </span>
            </div>
          </div>
          <p className="setup-desc-clean" style={{ textAlign: 'center' }}>
            {pdfProgress.total > 0
              ? `Reading papers for ${subject}…`
              : `Preparing ${pdfList?.length || 0} papers for ${subject}...`}
          </p>
          <p className="setup-subtext" style={{ textAlign: 'center' }}>This can take a moment for longer papers — please keep this tab open.</p>
        </div>
      </div>
    );
  }

  if (!isKeySaved) {
    return (
      <div className="ai-setup-container fade-in">
        <div className="setup-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AutoAwesome className="setup-icon" />
            <h3 style={{ margin: 0 }}>AI Predictor Engine</h3>
          </div>
          {onClose && (
            <button 
              onClick={handleClosePredictor}
              className="close-btn" 
              title="Close Predictor"
            >
              <Close sx={{ fontSize: 20 }} />
            </button>
          )}
        </div>
        <div className="setup-info-block">
          <p className="setup-desc-clean">
            You are about to analyze {pdfList?.length || 0} past papers for {subject}. This requires your Gemini API Key.
          </p>
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="google-studio-link"
          >
            Get a free API Key from Google AI Studio <span className="arrow">↗</span>
          </a>
          <p className="setup-subtext">Takes 30 seconds • No payment required</p>
        </div>
        
        <div className="video-container" style={{ position: 'relative' }}>
          <video 
            ref={videoRef}
            className="setup-video-player"
            controls={isVideoPlaying}
            playsInline
            preload="metadata"
            poster="/Tutorial/Thumbnail.jpg"
            onPause={(e) => {
              if (!e.target.seeking) {
                setIsVideoPlaying(false);
              }
            }}
            onEnded={() => setIsVideoPlaying(false)}
          >
            <source src="/Tutorial/T1.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          {!isVideoPlaying && (
            <div className="custom-thumbnail-overlay" onClick={handlePlayVideo}>
              <PlayCircleOutline className="custom-play-icon" sx={{ fontSize: 72 }} />
            </div>
          )}
        </div>

        <div className="api-input-group">
          <Key className="input-icon" />
          <input 
            type="password" 
            value={apiKey} 
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API Key here..."
          />
        </div>

        <div className="settings-group">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={isSessionOnly} 
              onChange={(e) => setIsSessionOnly(e.target.checked)} 
            />
            <span>Save key only for this session</span>
          </label>

          <div className="terms-wrapper">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={termsAccepted} 
                onChange={(e) => setTermsAccepted(e.target.checked)} 
              />
              <span>
                I accept the 
                <button className="text-link" onClick={() => setShowTerms(!showTerms)}>
                  Terms & Privacy Policy {showTerms ? <ExpandLess sx={{fontSize: 16, verticalAlign: 'middle'}}/> : <ExpandMore sx={{fontSize: 16, verticalAlign: 'middle'}}/>}
                </button>
              </span>
            </label>

            {showTerms && (
              <div className="terms-accordion fade-in">
                <ul>
                  <li><strong>Strictly Local Storage:</strong> Your API key is never sent to our database. It is stored exclusively in your browser's local or session storage and sent directly to Google's servers when you ask a question.</li>
                  <li><strong>Your Quota, Your Responsibility:</strong> You are using your personal Google account. We are not responsible for any billing, quota limits, or account suspensions resulting from your API usage.</li>
                  <li><strong>Security Liability:</strong> You are responsible for keeping your key safe. Beware of malicious browser extensions, and do not share your screen while your key is visible.</li>
                  <li><strong>AI Accuracy:</strong> Gemini is an AI and can make mistakes, especially with complex civil engineering calculations. Always verify the final answers against your textbooks or professors.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={handleSaveKey} 
          className="save-key-btn"
          disabled={!termsAccepted || apiKey.length < 20}
        >
          Save Key & Start
        </button>
      </div>
    );
  }

  return (
    <div className="chat-interface fade-in">

      <style>{`@media (max-width: 800px) {.ask-gemini-btn.open { display: none !important; }`}</style>

      {showRemoveKeyModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <div className="modal-icon-wrapper">
              <Key sx={{ fontSize: 32, color: '#f28b82' }} />
            </div>
            <h4>Remove API Key?</h4>
            <p>You will need to re-enter your Google Gemini API Key to use the AI chat again.</p>
            <div className="modal-actions">
              <button onClick={() => setShowRemoveKeyModal(false)} className="modal-btn cancel">Cancel</button>
              <button onClick={handleClearKey} className="modal-btn confirm">Remove</button>
            </div>
          </div>
        </div>
      )}
      
      <div className="chat-header">
        <div className="chat-title">
          <AutoAwesome sx={{ fontSize: 18, color: 'var(--accent)' }} />
          <span>Gemini Assistant</span>
        </div>
        
        <div className="header-menu-container" ref={headerMenuRef}>
          <button 
            type="button"
            className="icon-only-btn" 
            onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
          >
            <MoreVert sx={{ fontSize: 20 }} />
          </button>
          
            {isHeaderMenuOpen && (
              <div className="header-dropdown-menu">
                {onClose && (
                  <button type="button" className="dropdown-item danger" onClick={handleClosePredictor}>
                    <Close sx={{ fontSize: 16 }} /> Close & Clear Predictor
                  </button>
                )}
                <button type="button" className="dropdown-item" onClick={handleDownloadFullChat}>
                  <Download sx={{ fontSize: 16, color: 'var(--accent)' }} /> Download Full Chat (.pdf)
                </button>
                <button type="button" className="dropdown-item" onClick={() => setShowRemoveKeyModal(true)}>
                  <Logout sx={{ fontSize: 16 }} /> Remove API Key
                </button>
              </div>
            )}
        </div>
      </div>

      <div className="chat-messages-wrapper">
        <div className="chat-messages" ref={chatMessagesRef} onScroll={handleScroll}>
          {renderedMessages}           {/* Messages were lagging due to frequent re-renders. DO NOT REMOVE */}
          {isLoading && (
            <div className="message-wrapper ai">
              <div className="message-bubble ai typing">
                <span className="dot"></span><span className="dot"></span><span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {showScrollButton && (
          <button 
            className="scroll-to-bottom-btn" 
            onClick={scrollToBottom}
            title="Scroll to latest"
          >
            <KeyboardArrowDown sx={{ fontSize: 24 }} />
          </button>
        )}
      </div>
      <div className="chat-input-area">
        
        {replyToMsg && (
          <div className="reply-banner fade-in">
            <div className="reply-banner-content">
              <span className="reply-label">Replying to {replyToMsg.role === 'ai' ? 'Gemini' : 'Yourself'}:</span>
              <span className="reply-text-preview">{replyToMsg.text}</span>
            </div>
            <button type="button" onClick={() => setReplyToMsg(null)} className="cancel-reply-btn">
              <Close sx={{ fontSize: 16 }} />
            </button>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
          <button 
            type="button"
            onClick={(e) => handleSendMessage(e, "Based on the provided papers, what are the top 10 most highly probable 10-mark questions?")} 
            className="toggle-btn" 
            style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <AutoAwesome sx={{fontSize: 14}}/> Top 10 Predictions
          </button>
          <button 
            type="button"
            onClick={(e) => handleSendMessage(e, "Break down the historical weightage of marks per module.")} 
            className="toggle-btn" 
            style={{ whiteSpace: 'nowrap' }}
          >
            Module Weightage
          </button>
          <button 
            type="button"
            onClick={(e) => handleSendMessage(e, "Generate a realistic 50-mark mock paper based on these trends.")} 
            className="toggle-btn" 
            style={{ whiteSpace: 'nowrap' }}
          >
            Generate Mock Paper
          </button>
        </div>

        <form className="text-input-row" onSubmit={(e) => handleSendMessage(e, null)}>
          <input 
            type="text" 
            className="chat-text-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask a specific follow-up question..."
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="send-icon-btn" 
            disabled={isLoading || !userInput.trim()}
          >
            <Send sx={{ fontSize: 20 }} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIPredictorWidget;