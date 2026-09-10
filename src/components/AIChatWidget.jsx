import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { Send, Key, PlayCircleOutline, AutoAwesome, ExpandMore, ExpandLess, ContentCopy, Check, 
         Reply, Download, Edit, Close, Description, MoreVert, DeleteOutline, Logout, DeleteForever, KeyboardArrowDown } from '@mui/icons-material';
import './css/AIChatWidget.css';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { createSecureId } from '../utils/secureId';

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

const GEMINI_MODELS = {
  fast: 'gemini-3.5-flash-lite',
  pro: 'gemini-3.5-flash',
};

const AIChatWidget = ({ currentPage, pdfName, numPages, onCloseChat, pdfContainerRef }) => {
  const instanceId = useId();
  const [apiKey, setApiKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState('Solve Question 1');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isSessionOnly, setIsSessionOnly] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [selectedPages, setSelectedPages] = useState([1]);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [aiMode, setAiMode] = useState('fast');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuRef = useRef(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false); 
  const headerMenuRef = useRef(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);
  const [showRemoveKeyModal, setShowRemoveKeyModal] = useState(false);
  const [showCustomPageMenu, setShowCustomPageMenu] = useState(false);
  const [customPageStart, setCustomPageStart] = useState('');
  const [customPageEnd, setCustomPageEnd] = useState('');
  const customPageMenuRef = useRef(null);
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

          {msg.role === 'user' && msg.attachedPages && (
            <div className="message-footer user">
              <div className="attached-pages-pill">
                <Description sx={{ fontSize: 12 }} /> 
                Pages: {msg.attachedPages.join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    ));
  }, [messages, copiedIndex, activeMessageMenu, deleteConfirmIndex, instanceId]);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target)) {
        setIsModeMenuOpen(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        if (!event.target.closest('.custom-modal-overlay')) {
          setIsHeaderMenuOpen(false);
        }
      }
      if (customPageMenuRef.current && !customPageMenuRef.current.contains(event.target)) {
        setShowCustomPageMenu(false);
      }
      if (activeMessageMenu !== null && !event.target.closest('.message-action-dropdown') && !event.target.closest('.more-actions-trigger')) {
        setActiveMessageMenu(null);
        setDeleteConfirmIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModeMenuOpen, isHeaderMenuOpen, showCustomPageMenu, activeMessageMenu]);

  const togglePage = (pageNum) => {
    setSelectedPages(prev => {
      if (prev.includes(pageNum)) {
        return prev.filter(p => p !== pageNum);
      } else {
        return [...prev, pageNum].sort((a, b) => a - b);
      }
    });
  };

  const selectAllPages = (e) => {
    e.preventDefault();
    const all = Array.from({ length: numPages || 1 }, (_, i) => i + 1);
    setSelectedPages(all);
  };

  useEffect(() => {
    if (currentPage) {
      setSelectedPages([currentPage]);
    }
  }, [currentPage]);

  useEffect(() => {
    if (numPages && !selectedPages.includes(numPages) && selectedPages.length === 1 && selectedPages[0] === 1) {
      console.log(`PDF Loaded with ${numPages} pages.`);
    }
  }, [numPages]);

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
      const savedMessages = localStorage.getItem(`chat_${pdfName}_${secureId}`);
      
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      } else {
        setMessages([{ 
          id: 'greeting',
          role: 'ai', 
          text: `Hi! I'm ready to help you study ${pdfName}. Type your request below and I'll analyze the current PDF page for you.` 
        }]);
      }
    }
  }, [pdfName]);

  useEffect(() => {
    if (messages.length > 0 && isKeySaved && apiKey) {
      const secureId = createSecureId(apiKey);
      localStorage.setItem(`chat_${pdfName}_${secureId}`, JSON.stringify(messages));
    }
  }, [messages, pdfName, isKeySaved, apiKey]);


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
      const savedMessages = localStorage.getItem(`chat_${pdfName}_${secureId}`);
      
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      } else {
        setMessages([{ 
          role: 'ai', 
          text: `Key saved! I can see page ${currentPage}. Ask me to solve questions or explain concepts from this pdf.` 
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
    element.download = `${pdfName}_AI_Explanation.txt`;
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
      const cleanName = pdfName ? pdfName.replace('.pdf', '') : 'Chat';
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
      
      const fileName = pdfName 
        ? `${pdfName.replace('.pdf', '')}_Full_Chat.pdf` 
        : 'Chat_Full_History.pdf';

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

  const handleClearChat = () => {
    setMessages([{ 
      role: 'ai', 
      text: `Chat cleared. I'm ready to help you study ${pdfName} again!` 
    }]);
    setShowClearModal(false);
    setIsHeaderMenuOpen(false);
    setReplyToMsg(null);
  };

  const handleApplyCustomPages = () => {
    const start = parseInt(customPageStart);
    const end = parseInt(customPageEnd);
    
    if (isNaN(start) || isNaN(end) || start < 1 || end > numPages || start > end) {
      alert(`Please enter a valid range between 1 and ${numPages}`);
      return;
    }
    
    const range = [];
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    setSelectedPages(range);
    setShowCustomPageMenu(false);
    setCustomPageStart('');
    setCustomPageEnd('');
  };

  const handleClearAllHistory = () => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('chat_')) {
        localStorage.removeItem(key);
      }
    });
    setMessages([{ 
      role: 'ai', 
      text: 'All saved chats and histories across the entire website have been permanently erased.' 
    }]);
    setShowClearAllModal(false);
    setIsHeaderMenuOpen(false);
    setReplyToMsg(null);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const currentReply = replyToMsg;
    setReplyToMsg(null); 
    
    const textToSend = userInput;
    const newUserId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    setMessages(prev => [...prev, { 
      id: newUserId,
      role: 'user', 
      text: textToSend, 
      attachedPages: [...selectedPages],
      replyTo: currentReply ? { id: currentReply.id || `legacy-${messages.indexOf(currentReply)}`, role: currentReply.role, text: currentReply.text } : null 
    }]);

    setUserInput('');
    setIsLoading(true);

      try {
        const scopeElement = pdfContainerRef?.current || document;
        const canvases = scopeElement.querySelectorAll('.react-pdf__Page canvas');
        if (canvases.length === 0) throw new Error("Could not find the PDF. Is it loaded?");
        if (selectedPages.length === 0) throw new Error("Please select at least one page to attach.");

        let contextAddition = "";
        if (currentReply) {
          contextAddition = `\n\nCRITICAL CONTEXT: The student is asking this follow-up question in direct reference to this previous text: "${replyToMsg.text}"`;
        }
        
        const fastPrompt = `Context: You are a strict, highly efficient grading assistant for civil engineering. The student wants quick, direct answers to verify their work.
                            NO introductory filler.
                            For MCQs: Output ONLY the question number and correct option.(e.g., 'Q1: (c) 45 degrees'). Do not explain why unless explicitly asked.
                            For Subjective Theory: Write a concise, exam-ready answer structured to match full-mark scoring criteria. Include all key technical terms, definitions, and classifications. Ensure coverage = what examiner expects for full marks.
                            For Calculations: State the primary formula, the substituted numerical values, and the final answer. Skip all intermediate theoretical explanations. (Crucial rule: You must write out the substituted values before the final answer to ensure mathematical accuracy).
                            FORMATTING RULES: 
                            1. SPACING: You MUST leave a clear blank empty line between paragraphs, different questions, and list items for readability.
                            2. TABLES: Use standard Markdown table syntax (|---|---|). Always place exactly ONE blank empty line before and after the table.
                            3. MATH: You MUST use standard LaTeX. Enclose inline math in single $ symbols and block equations in double $$ symbols. Use \\frac{}{} for all division.`;

        const proPrompt = `Context: You are an expert, patient civil engineering professor. The student is trying to deeply understand the concepts in the provided exam paper.
                           Break down complex problems step-by-step. Explain the 'why' behind formulas, reference standard IS codes or structural theories if applicable, and provide thorough, easy-to-follow explanations.
                           Take a deep breath and work through the problem step-by-step before providing the final answer.
                           FORMATTING RULES: 
                            1. SPACING: You MUST leave a clear blank empty line between paragraphs, different questions, and list items for readability.
                            2. TABLES: Use standard Markdown table syntax (|---|---|). Always place exactly ONE blank empty line before and after the table.
                            3. MATH: You MUST use standard LaTeX. Enclose inline math in single $ symbols and block equations in double $$ symbols. Use \\frac{}{} for all division.`;

        const selectedPrompt = aiMode === 'fast' ? fastPrompt : proPrompt;
        
        const currentMessageParts = [
          { text: `${contextAddition}\n\nStudent Question: ${textToSend}` }
        ];
        selectedPages.forEach(pageNum => {
          const canvasIndex = pageNum - 1; 
          if (canvases[canvasIndex]) {
            const base64Image = canvases[canvasIndex].toDataURL('image/jpeg', 0.5).split(',')[1];
            currentMessageParts.push({
              inlineData: { mimeType: "image/jpeg", data: base64Image }
            });
          }
        });

        const tableRules = "\n\nCRITICAL TABLE RULES: When generating tables, use strict Markdown syntax. You MUST include the header separator row (e.g., |---|---|). NEVER put newlines or line breaks inside table rows or cells. Always leave a blank empty line before and after the table.";

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS[aiMode]}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: selectedPrompt + tableRules }] 
            },
            contents: [{
              role: 'user',
              parts: currentMessageParts
            }]
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
        setMessages(prev => [...prev, { id: 'error-msg', role: 'ai', text: `Error: ${error.message}` }]);
      } finally {
        setIsLoading(false);
      }
      
  };

  if (!isKeySaved) {
    return (
      <div className="ai-setup-container fade-in">
        <div className="setup-header">
          <AutoAwesome className="setup-icon" />
          <h3>Unlock AI Solutions</h3>
        </div>
        <div className="setup-info-block">
          <p className="setup-desc-clean">
            To keep this student platform free, this tool runs on your personal Gemini API key.
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

      {showClearModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <div className="modal-icon-wrapper">
              <DeleteForever sx={{ fontSize: 32, color: '#f28b82' }} />
            </div>
            <h4>Clear Conversation?</h4>
            <p>This will delete your entire chat history for this session. This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setShowClearModal(false)} className="modal-btn cancel">Cancel</button>
              <button onClick={handleClearChat} className="modal-btn confirm">Clear Chat</button>
            </div>
          </div>
        </div>
      )}

      {showClearAllModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <div className="modal-icon-wrapper">
              <DeleteForever sx={{ fontSize: 32, color: '#f28b82' }} />
            </div>
            <h4>Erase All Saved Chats?</h4>
            <p>This will permanently delete ALL chat histories across every paper on this website. This cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setShowClearAllModal(false)} className="modal-btn cancel">Cancel</button>
              <button onClick={handleClearAllHistory} className="modal-btn confirm">Erase All</button>
            </div>
          </div>
        </div>
      )}

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
                {onCloseChat && (
                  <button type="button" className="dropdown-item mobile-only-item" onClick={onCloseChat}>
                    <Close sx={{ fontSize: 16 }} /> Close Chat
                  </button>
                )}
                <button type="button" className="dropdown-item danger" onClick={() => setShowClearModal(true)}>
                  <DeleteOutline sx={{ fontSize: 16 }} /> Clear Current Chat
                </button>
                <button type="button" className="dropdown-item danger" onClick={() => setShowClearAllModal(true)}>
                  <DeleteForever sx={{ fontSize: 16 }} /> Erase All Saved Chats
                </button>
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
        
        <div className="page-toggle-wrapper">
          <span className="toggle-label">Pages:</span>
          <div className="toggle-grid">
            {Array.from({ length: Math.min(numPages || 1, 4) }, (_, i) => i + 1).map(num => (
              <button 
                key={num}
                type="button"
                onClick={(e) => { e.preventDefault(); togglePage(num); }}
                className={`toggle-btn ${selectedPages.includes(num) ? 'active' : ''}`}
              >
                {num}
              </button>
            ))}
            {numPages > 4 && (
              <div className="custom-page-container" ref={customPageMenuRef} style={{ position: 'relative' }}>
                <button 
                  type="button" 
                  className={`toggle-btn ${selectedPages.length > 1 && selectedPages.length < numPages && !selectedPages.includes(1) ? 'active' : ''}`}
                  onClick={() => setShowCustomPageMenu(!showCustomPageMenu)}
                  title="Custom Page Range"
                >
                  ...
                </button>
                
                {showCustomPageMenu && (
                  <div className="custom-page-dropup">
                    <div className="custom-page-inputs">
                      <input type="number" placeholder="From" min="1" max={numPages} value={customPageStart} onChange={e => setCustomPageStart(e.target.value)} />
                      <span>-</span>
                      <input type="number" placeholder="To" min="1" max={numPages} value={customPageEnd} onChange={e => setCustomPageEnd(e.target.value)} />
                    </div>
                    <button type="button" className="custom-page-apply" onClick={handleApplyCustomPages}>Apply Range</button>
                  </div>
                )}
              </div>
            )}
            {numPages > 1 && (
              <button 
                type="button"
                onClick={selectAllPages} 
                className={`toggle-btn ${selectedPages.length === numPages ? 'active' : ''}`}
              >
                All
              </button>
            )}
          </div>
        </div>

        <form className="text-input-row" onSubmit={handleSendMessage}>
          <div className="mode-selector-container" ref={modeMenuRef}>
            <button 
              type="button" 
              className="mode-toggle-btn"
              onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
            >
              {aiMode === 'fast' ? '⚡ Fast' : '🧠 Pro'}
              <ExpandLess sx={{ fontSize: 16, transition: 'transform 0.2s', transform: isModeMenuOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {isModeMenuOpen && (
              <div className="mode-dropup-menu">
                <button 
                  type="button"
                  className={`mode-option ${aiMode === 'fast' ? 'active' : ''}`}
                  onClick={() => { setAiMode('fast'); setIsModeMenuOpen(false); }}
                >
                  <div className="mode-option-title">⚡ Fast</div>
                  <div className="mode-option-desc">Quick, direct answers for grading</div>
                </button>
                <button 
                  type="button"
                  className={`mode-option ${aiMode === 'pro' ? 'active' : ''}`}
                  onClick={() => { setAiMode('pro'); setIsModeMenuOpen(false); }}
                >
                  <div className="mode-option-title">🧠 Pro</div>
                  <div className="mode-option-desc">Step-by-step deep learning</div>
                </button>
              </div>
            )}
          </div>

          <input 
            type="text" 
            className="chat-text-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your question..."
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

export default AIChatWidget;