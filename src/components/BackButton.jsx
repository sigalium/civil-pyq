import { ArrowBack } from '@mui/icons-material'
import './css/BackButton.css'

const BackButton = ({ onClick, text }) => {
  return (
    <button className="back-btn" onClick={onClick}>
      <ArrowBack className="back-icon" />
      {text}
    </button>
  )
}

export default BackButton