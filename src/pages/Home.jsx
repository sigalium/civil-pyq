import { Link } from 'react-router-dom'
import './styles/Home.css'

const Home = () => {
  return (
    <div className="home fade-in">
      <div className="home-content">
        <h1>Welcome to <span>CivilPYQ</span></h1>
        <p className="subtitle">
          Your one-stop destination for past year question papers, lab manuals, and study resources for Civil Engineering students of GCU.
        </p>
        <Link to="/resources" className="resources-btn">
          To Resources
        </Link>
      </div>
    </div>
  )
}

export default Home