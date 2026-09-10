import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import FolderIcon from '@mui/icons-material/Folder';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useResourcesData } from '../context/useResourcesData';
import { usePDFWindows } from '../context/usePDFWindows';
import './css/ResourcesQuickNav.css';

const ResourcesQuickNav = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { academicCalendarPath } = useResourcesData();
  const { openPdf } = usePDFWindows();

  if (!location.pathname.startsWith('/resources')) return null;

  const handleResourcesClick = () => {
    setOpen(false);
    const path = location.pathname;
    const inSemesterBrowsing = path === '/resources' || /^\/resources\/\d+(\/[^/]+)?$/.test(path);
    if (inSemesterBrowsing) return;
    navigate('/resources');
  };

  const handleCalendar = () => {
    setOpen(false);
    if (!academicCalendarPath) {
      alert('Academic Calendar has not been uploaded yet.');
      return;
    }
    openPdf({ name: 'Academic Calendar', path: academicCalendarPath });
  };

  return (
    <div className="resources-quicknav">
      <button className="resources-quicknav-trigger" onClick={() => setOpen(true)} aria-label="Open quick navigation">
        <ChevronLeftIcon sx={{ fontSize: 22 }} />
      </button>

      {open && <div className="resources-quicknav-backdrop" onClick={() => setOpen(false)} />}

      <div className={`resources-quicknav-drawer ${open ? 'open' : ''}`}>
        <button className="resources-quicknav-item" onClick={handleResourcesClick}>
          <FolderIcon sx={{ fontSize: 18 }} /> Resources
        </button>
        <button className="resources-quicknav-item" onClick={handleCalendar}>
          <CalendarMonthIcon sx={{ fontSize: 18 }} /> Academic Calendar
        </button>
        <button className="resources-quicknav-item" onClick={() => { setOpen(false); navigate('/resources/codes-and-standards', { state: { from: location.pathname } }); }}>
          <MenuBookIcon sx={{ fontSize: 18 }} /> Codes & Standards
        </button>
      </div>
    </div>
  );
};

export default ResourcesQuickNav;
