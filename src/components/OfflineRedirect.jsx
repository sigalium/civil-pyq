import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const OFFLINE_SAFE_PATHS = ['/offline-library', '/settings'];

const OfflineRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const goOffline = () => {
      if (!OFFLINE_SAFE_PATHS.includes(location.pathname)) {
        navigate('/offline-library');
      }
    };

    if (!navigator.onLine) {
      goOffline();
    }

    window.addEventListener('offline', goOffline);
    return () => window.removeEventListener('offline', goOffline);
  }, [navigate, location.pathname]);

  return null;
};

export default OfflineRedirect;
