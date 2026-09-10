import { useNavigate } from 'react-router-dom';
import { CheckCircle, CloudDone, ChevronRight, PhoneIphone } from '@mui/icons-material';
import { useTheme } from '../context/useTheme';
import { listOfflineItems } from '../utils/offlineStorage';
import BackButton from '../components/BackButton';
import './styles/Settings.css';

const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches;

const Settings = () => {
  const navigate = useNavigate();
  const { theme, setTheme, themes } = useTheme();
  const offlineCount = listOfflineItems().length;

  return (
    <div className="settings-page fade-in">
      <div className="settings-container">
        <BackButton onClick={() => navigate('/')} text="Home" className="back-btn-page-top" />
        <h2 className="settings-title">Settings</h2>

        <section className="settings-section">
          <h3 className="settings-section-title">Theme</h3>
          <p className="settings-section-hint">
            Pick a look for the app. Each theme has its own colours, font, and animated background.
          </p>
          <div className="theme-grid">
            {themes.map((t) => (
              <button
                key={t.id}
                className={`theme-card ${theme === t.id ? 'active' : ''}`}
                onClick={() => setTheme(t.id)}
                aria-pressed={theme === t.id}
              >
                <div className="theme-swatch">
                  {t.swatch.map((color, i) => (
                    <span key={i} style={{ background: color }} />
                  ))}
                </div>
                <div className="theme-card-body">
                  <span className="theme-card-label">{t.label}</span>
                  <span className="theme-card-desc">{t.description}</span>
                </div>
                {theme === t.id && <CheckCircle className="theme-card-check" />}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Storage</h3>
          <button className="settings-link-row" onClick={() => navigate('/offline-library')}>
            <div className="settings-link-row-left">
              <CloudDone className="settings-link-icon" />
              <div>
                <span className="settings-link-label">Offline Library</span>
                <span className="settings-link-sub">
                  {offlineCount > 0
                    ? `${offlineCount} file${offlineCount > 1 ? 's' : ''} saved for offline use`
                    : 'No files saved yet'}
                </span>
              </div>
            </div>
            <ChevronRight />
          </button>
        </section>

        {isMobile && (
          <section className="settings-section">
            <div className="settings-note">
              <PhoneIphone className="settings-note-icon" />
              <p>Some features (like multi-tab PDF viewing) are limited on mobile to keep things fast and simple.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Settings;
