import { Link } from 'react-router-dom'
import { CREATOR_LINKS, GCU_LINKS, PRODUCT_LINKS } from '../data/appData'
import './css/Footer.css'

const Footer = () => {
  return (
    <footer className="footer fade-in">
      <div className="footer-container">
        <div className="footer-links footer-gcu">
          <h4>GCU Links</h4>
          <a href={GCU_LINKS.academics} target="_blank" rel="noopener noreferrer">Academics</a>
          <a href={GCU_LINKS.website} target="_blank" rel="noopener noreferrer">GCU Website</a>
          <a href={GCU_LINKS.digitalLibrary} target="_blank" rel="noopener noreferrer">Digital Library</a>
          <a href={GCU_LINKS.contact} target="_blank" rel="noopener noreferrer">Contact GCU</a>
        </div>
        <div className="footer-links footer-useful">
          <h4>Useful Links</h4>
          <Link to="/">Home</Link>
          <a href={GCU_LINKS.results} target="_blank" rel="noopener noreferrer">Results</a>
          <Link to="/resources">Resources</Link>
          <Link to="/domains">Alternative Domains</Link>
        </div>
        <div className="footer-links footer-products">
          <h4>More Products</h4>
          <a href={PRODUCT_LINKS.shearFrame} target="_blank" rel="noopener noreferrer">ShearFrame</a>
          <a href={PRODUCT_LINKS.shearCad} target="_blank" rel="noopener noreferrer">ShearCAD</a>
          <a href={PRODUCT_LINKS.shearFooting} target="_blank" rel="noopener noreferrer">ShearFooting</a>
          <a href={CREATOR_LINKS.github} target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <div className="footer-contact footer-contact-section">
          <h4>Contact</h4>
          <a href={CREATOR_LINKS.website} target="_blank" rel="noopener noreferrer">Website</a>
          <a href={CREATOR_LINKS.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href={CREATOR_LINKS.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href={`mailto:${CREATOR_LINKS.email}`}>Email</a>
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
