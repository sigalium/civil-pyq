import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import FolderIcon from '@mui/icons-material/Folder';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import InfoIcon from '@mui/icons-material/Info';
import './css/BottomNavbar.css';

const BottomNavbar = () => {
  const [activeTab, setActiveTab] = useState('/');
  const location = useLocation();

  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location]);

  return (
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
    </div>
  );
};

export default BottomNavbar;