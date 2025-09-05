import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import './css/Navbar.css'

const Navbar = ({ isMenuOpen, setIsMenuOpen }) => {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const navLinksRef = useRef(null)
  const menuToggleRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = (event) => {
      if (
        navLinksRef.current &&
        !navLinksRef.current.contains(event.target) &&
        menuToggleRef.current &&
        !menuToggleRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen, setIsMenuOpen])

  return (
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
            className={`nav-link${
              location.pathname === '/' ? ' active' : ''
            }`}
            onClick={() => setIsMenuOpen(false)}  >
            Home
          </Link>
          <Link
            to="/resources"
            className={`nav-link${
              location.pathname.startsWith('/resources') ? ' active' : ''
            }`}
            onClick={() => setIsMenuOpen(false)}  >
            Resources
          </Link>
          <Link
            to="/contribute"
            className={`nav-link${
              location.pathname === '/contribute' ? ' active' : ''
            }`}
            onClick={() => setIsMenuOpen(false)}  >
            Contribute
          </Link>
          <Link
            to="/about"
            className={`nav-link${
              location.pathname === '/about' ? ' active' : ''
            }`}
            onClick={() => setIsMenuOpen(false)}  >
            About
          </Link>
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
  )
}

export default Navbar