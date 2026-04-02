
import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import PDFViewer from './PDFViewer';
import './css/Navbar.css'


const Navbar = ({ isMenuOpen, setIsMenuOpen }) => {
  const [scrolled, setScrolled] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const location = useLocation()
  const navLinksRef = useRef(null)
  const menuToggleRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMenuOpen &&
        navLinksRef.current &&
        !navLinksRef.current.contains(event.target) &&
        menuToggleRef.current &&
        !menuToggleRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false)
      }
      if (
        isDropdownOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen, setIsMenuOpen, isDropdownOpen])

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <Link to="/" className="logo fade-in">
            Civil<span>PYQ</span>
          </Link>

          <div
            className={`nav-links ${isMenuOpen ? 'active' : ''}`}
            ref={navLinksRef} >
            <Link
              to="/"
              className={`nav-link${location.pathname === '/' ? ' active' : ''}`}
              onClick={() => setIsMenuOpen(false)}  >
              Home
            </Link>
            <Link
              to="/resources"
              className={`nav-link${location.pathname.startsWith('/resources') ? ' active' : ''}`}
              onClick={() => setIsMenuOpen(false)}  >
              Resources
            </Link>
            <Link
              to="/contribute"
              className={`nav-link${location.pathname === '/contribute' ? ' active' : ''}`}
              onClick={() => setIsMenuOpen(false)}  >
              Contribute
            </Link>

            <div className="about-dropdown-wrapper" ref={dropdownRef}>
              <div className="about-split-container">
                <Link
                  to="/about"
                  className={`nav-link about-link-text ${location.pathname === '/about' ? 'active' : ''}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  About
                </Link>
                <button 
                  className="about-dropdown-arrow"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsDropdownOpen(!isDropdownOpen);
                  }}
                >
                  <KeyboardArrowDownIcon sx={{ 
                    fontSize: 20, 
                    transition: 'transform 0.3s ease',
                    transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }} />
                </button>
              </div>

              <div className={`calendar-dropdown-menu ${isDropdownOpen ? 'show' : ''}`}>
                <button
                  className="calendar-dropdown-item"
                  onClick={() => {
                    setShowCalendar(true);
                    setIsDropdownOpen(false);
                    setIsMenuOpen(false);
                  }}
                >
                  <CalendarMonthIcon sx={{ fontSize: 18 }} /> Academic Calendar
                </button>
              </div>
            </div>
          </div>

          <button
            className="menu-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
            ref={menuToggleRef}   >
            {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      {showCalendar && (
        <PDFViewer
          pdfPath="/pdfs/Academic_Calendar_2025-2026.pdf"
          pdfName="Academic Calendar 2025-2026"
          onClose={() => setShowCalendar(false)}
        />
      )}
    </>
  )
}

export default Navbar