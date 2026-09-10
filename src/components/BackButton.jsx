import { ArrowBack } from '@mui/icons-material'
import './css/BackButton.css'

const BackButton = ({ onClick, text, className = '' }) => {
  return (
    <button className={`back-btn ${className}`} onClick={onClick}>
      <ArrowBack className="back-icon" />
      {text}
    </button>
  )
}

export default BackButton