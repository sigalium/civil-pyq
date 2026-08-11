import { AutoAwesome } from '@mui/icons-material';
import './css/AskGeminiButton.css';

const AskGeminiButton = ({ onClick, isOpen, buttonText, windowed = false }) => {
  return (
    <button 
      className={`ask-gemini-btn ${isOpen ? 'open' : ''} ${windowed ? 'windowed' : ''}`} 
      onClick={onClick}
      title={isOpen ? "Close AI Chat" : buttonText}
    >
      <div className="btn-content">
        <AutoAwesome className="gemini-icon" />
        <span className="btn-text">{isOpen ? "Close Chat" : buttonText}</span>
      </div>
    </button>
  );
};

export default AskGeminiButton;