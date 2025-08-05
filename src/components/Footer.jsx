import { Link } from 'react-router-dom'
import './css/Footer.css'

const Footer = () => {
  return (
    <footer className="footer fade-in">
      <div className="footer-container">
        <div className="footer-links">
          <h4>GCU Links</h4>
          <a href="https://gcuniversity.ac.in/school-of-engineering-and-technology/" target="_blank" rel="noopener noreferrer">Academics</a>         
          <a href="https://gcuniversity.ac.in/" target="_blank" rel="noopener noreferrer">GCU Website</a> 
          <a href="https://gcu-dl.bsmlib.com/" target="_blank" rel="noopener noreferrer">Digital Library</a>  
          <a href="https://gcuniversity.ac.in/contact/" target="_blank" rel="noopener noreferrer">Contact GCU</a>
        </div>
        <div className="footer-links">
          <h4>Useful Links</h4>
          <Link to="/">Home</Link>
          <a href="https://gcuniversity.ac.in/results/" target="_blank" rel="noopener noreferrer">Results</a>
          <Link to="/resources">Resources</Link>
          <Link to="/domains">Alternative Domains</Link>
        </div>
        <div className="footer-contact">
          <h4>Contact</h4>
          <a href="https://priyangkam.netlify.app" target="_blank" rel="noopener noreferrer">Website</a>
          <a href="https://www.instagram.com/priyangkamb" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://github.com/sigalium" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="mailto:priyangkam.bhuyan@gmail.com">Email</a>     
        </div>
      </div>
      <div className="footer-bottom">
        <p>
          &copy; {new Date().getFullYear()}{" "}
          <Link to="/about" className="footer-logo-link">Civil<span>PYQ</span></Link>. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
