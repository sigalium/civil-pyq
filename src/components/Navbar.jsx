import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import AccountMenuContent from './AccountMenuContent';
import { usePDFWindows } from '../context/usePDFWindows'
import { useResourcesData } from '../context/useResourcesData'
import './css/Navbar.css'


const Navbar = ({ isMenuOpen, setIsMenuOpen }) => {
  const { openPdf } = usePDFWindows()
  const { academicCalendarPath } = useResourcesData()
  const [scrolled, setScrolled] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const location = useLocation()
  const navLinksRef = useRef(null)
  const menuToggleRef = useRef(null)
  const dropdownRef = useRef(null)
  const accountRef = useRef(null)

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
      if (
        isAccountOpen &&
        accountRef.current &&
        !accountRef.current.contains(event.target)
      ) {
        setIsAccountOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen, setIsMenuOpen, isDropdownOpen, isAccountOpen])

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <div className="navbar-left">
            <Link to="/" className="logo fade-in">
              <svg className="logo-mark" viewBox="52 52 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M138 62 L92 62 L62 92 L62 108 L92 138 L138 138" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="88" y="93" width="30" height="14" rx="4" fill="var(--accent)" />
              </svg>
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

              <div className="nav-dropdown-wrapper" ref={dropdownRef}>
                <div className="nav-split-container">
                  <Link
                    to="/resources"
                    className={`nav-link nav-split-link-text ${location.pathname.startsWith('/resources') ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Resources
                  </Link>
                  <button
                    className="nav-dropdown-arrow"
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
                      openPdf({ name: 'Academic Calendar', path: academicCalendarPath });
                      setIsDropdownOpen(false);
                      setIsMenuOpen(false);
                    }}
                  >
                    <CalendarMonthIcon sx={{ fontSize: 18 }} /> Academic Calendar
                  </button>
                  <Link
                    to="/resources/codes-and-standards"
                    state={{ from: location.pathname }}
                    className="calendar-dropdown-item"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsMenuOpen(false);
                    }}
                  >
                    <MenuBookIcon sx={{ fontSize: 18 }} /> Codes & Standards
                  </Link>
                </div>
              </div>

              <Link
                to="/contribute"
                className={`nav-link${location.pathname === '/contribute' ? ' active' : ''}`}
                onClick={() => setIsMenuOpen(false)}  >
                Contribute
              </Link>

              <Link
                to="/about"
                className={`nav-link${location.pathname === '/about' ? ' active' : ''}`}
                onClick={() => setIsMenuOpen(false)}  >
                About
              </Link>
            </div>
          </div>

          <div className="navbar-right">
            <div className="account-menu-wrapper" ref={accountRef}>
              <button
                className={`nav-settings-link${isAccountOpen ? ' active' : ''}`}
                aria-label="Account"
                onClick={() => setIsAccountOpen(!isAccountOpen)}
              >
                <AccountCircleIcon sx={{ fontSize: 22 }} />
              </button>

              <div className={`account-dropdown-menu ${isAccountOpen ? 'show' : ''}`}>
                <AccountMenuContent
                  itemClassName="account-dropdown-item"
                  onNavigate={() => setIsAccountOpen(false)}
                />
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
        </div>
      </nav>
    </>
  )
}

export default Navbar
