import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import HomeIcon from '@mui/icons-material/Home';
import FolderIcon from '@mui/icons-material/Folder';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import InfoIcon from '@mui/icons-material/Info';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CloseIcon from '@mui/icons-material/Close';
import AccountMenuContent from './AccountMenuContent';
import './css/BottomNavbar.css';

const BottomNavbar = () => {
  const [activeTab, setActiveTab] = useState('/');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location]);

  useEffect(() => {
    setIsSheetOpen(false);
  }, [location]);

  return (
    <>
      <div className="bottom-navbar">
        <Link
          to="/"
          className={`bottom-nav-item ${activeTab === '/' ? 'active' : ''}`}
        >
          <HomeIcon className="bottom-nav-icon" />
          <span className="bottom-nav-label">Home</span>
        </Link>

        <Link
          to="/resources"
          className={`bottom-nav-item ${activeTab.startsWith('/resources') ? 'active' : ''}`}
        >
          <FolderIcon className="bottom-nav-icon" />
          <span className="bottom-nav-label">Resources</span>
        </Link>

        <Link
          to="/contribute"
          className={`bottom-nav-item ${activeTab === '/contribute' ? 'active' : ''}`}
        >
          <AddCircleIcon className="bottom-nav-icon" />
          <span className="bottom-nav-label">Contribute</span>
        </Link>

        <Link
          to="/about"
          className={`bottom-nav-item ${activeTab === '/about' ? 'active' : ''}`}
        >
          <InfoIcon className="bottom-nav-icon" />
          <span className="bottom-nav-label">About</span>
        </Link>

        <button
          type="button"
          className={`bottom-nav-item bottom-nav-item-button ${
            activeTab === '/settings' || activeTab === '/dashboard' || activeTab === '/offline-library' ? 'active' : ''
          }`}
          onClick={() => setIsSheetOpen(true)}
        >
          <AccountCircleIcon className="bottom-nav-icon" />
          <span className="bottom-nav-label">Account</span>
        </button>
      </div>

      <AnimatePresence>
        {isSheetOpen && (
          <Motion.div
            className="account-sheet-overlay"
            onClick={() => setIsSheetOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Motion.div
              className="account-sheet"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="account-sheet-handle" />
              <div className="account-sheet-header">
                <span>Account</span>
                <button className="account-sheet-close" onClick={() => setIsSheetOpen(false)} aria-label="Close">
                  <CloseIcon sx={{ fontSize: 20 }} />
                </button>
              </div>
              <AccountMenuContent
                itemClassName="account-sheet-item"
                onNavigate={() => setIsSheetOpen(false)}
              />
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BottomNavbar;
