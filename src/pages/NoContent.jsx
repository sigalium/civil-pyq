import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import './styles/NoContent.css'

const NoContent = ({ semester }) => {
  return (
    <div className="no-content fade-in">
      <BackButton onClick={() => window.history.back()} text="Back" />
      <div className="no-content-container">
        <h2>Semester {semester}</h2>
        <p className="message">
          Sorry, no content available for this semester yet. <br />
          Help us make this website better by contributing!
        </p>
        <Link to="/contribute" className="contribute-btn">
          Contribute Now
        </Link>
      </div>
    </div>
  )
}

export default NoContent