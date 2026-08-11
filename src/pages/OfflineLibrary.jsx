import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, PictureAsPdf, DeleteSweep, CloudOff } from '@mui/icons-material';
import BackButton from '../components/BackButton';
import { usePDFWindows } from '../context/PDFWindowContext';
import {
  listOfflineItems,
  removeOffline,
  clearAllOffline,
  getStorageEstimate,
  isOfflineSupported,
} from '../utils/offlineStorage';
import './styles/OfflineLibrary.css';

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const OfflineLibrary = () => {
  const navigate = useNavigate();
  const { openPdf } = usePDFWindows();
  const [items, setItems] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [removingPath, setRemovingPath] = useState(null);

  const refresh = useCallback(async () => {
    setItems(listOfflineItems());
    setEstimate(await getStorageEstimate());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRemove = async (path) => {
    setRemovingPath(path);
    try {
      await removeOffline(path);
      await refresh();
    } finally {
      setRemovingPath(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Remove all files saved for offline use?')) return;
    await clearAllOffline();
    await refresh();
  };

  const usedPercent = estimate && estimate.quota
    ? Math.min(100, (estimate.usage / estimate.quota) * 100)
    : null;

  return (
    <div className="offline-library-page fade-in">
      <div className="offline-library-container">
        <BackButton onClick={() => navigate('/settings')} text="Settings" />
        <h2 className="offline-library-title">Offline Library</h2>
        <p className="offline-library-hint">
          Files saved here open with no internet connection, right from this device.
        </p>

        {!isOfflineSupported() && (
          <div className="offline-unsupported">
            <CloudOff /> Offline storage isn't supported in this browser.
          </div>
        )}

        {estimate && estimate.quota > 0 && (
          <div className="storage-meter">
            <div className="storage-meter-bar">
              <div className="storage-meter-fill" style={{ width: `${usedPercent}%` }} />
            </div>
            <span className="storage-meter-label">
              {formatBytes(estimate.usage)} used of {formatBytes(estimate.quota)} available on this device
            </span>
          </div>
        )}

        {items.length === 0 ? (
          <div className="offline-empty">
            <PictureAsPdf sx={{ fontSize: 40 }} />
            <p>No files saved offline yet.</p>
            <span>Open Resources, then tap the cloud icon next to a PYQ or lab file to save it here.</span>
          </div>
        ) : (
          <>
            <div className="offline-list">
              {items.map((item) => (
                <div className="offline-item" key={item.path}>
                  <div className="offline-item-info" onClick={() => openPdf({ name: item.name, path: item.path })}>
                    <PictureAsPdf className="offline-item-icon" />
                    <div className="offline-item-text">
                      <span className="offline-item-name">{item.name}</span>
                      <span className="offline-item-meta">
                        {item.subject ? `${item.subject} · ` : ''}{formatBytes(item.size)}
                      </span>
                    </div>
                  </div>
                  <button
                    className="offline-remove-btn"
                    disabled={removingPath === item.path}
                    onClick={() => handleRemove(item.path)}
                    aria-label={`Remove ${item.name} from offline library`}
                  >
                    <Delete />
                  </button>
                </div>
              ))}
            </div>

            <button className="offline-clear-all" onClick={handleClearAll}>
              <DeleteSweep sx={{ fontSize: 18 }} /> Clear all offline files
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineLibrary;
