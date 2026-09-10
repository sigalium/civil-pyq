import { useState, useEffect, useCallback } from 'react';
import { CloudDownload, CloudDone, HourglassEmpty } from '@mui/icons-material';
import { saveOffline, removeOffline, isSavedOffline, isOfflineSupported } from '../utils/offlineStorage';
import './css/ResourceList.css'

const ResourceList = ({ title, items, onItemClick, subject, footer }) => {
  const [offlineMap, setOfflineMap] = useState({});
  const [pendingPath, setPendingPath] = useState(null);

  const refreshOfflineState = useCallback(() => {
    const map = {};
    items.forEach((item) => {
      const path = item.path || '';
      if (path) map[path] = isSavedOffline(path);
    });
    setOfflineMap(map);
  }, [items]);

  useEffect(() => {
    refreshOfflineState();
  }, [refreshOfflineState]);

  const handleToggleOffline = async (e, item) => {
    e.stopPropagation();
    const path = item.path;
    if (!path || !isOfflineSupported() || pendingPath) return;

    setPendingPath(path);
    try {
      if (offlineMap[path]) {
        await removeOffline(path);
      } else {
        await saveOffline({ path, name: item.name || item, subject });
      }
      refreshOfflineState();
    } catch (err) {
      alert(err.message || 'Something went wrong saving this file offline.');
    } finally {
      setPendingPath(null);
    }
  };

  return (
    <div className="resource-list">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => {
            const path = item.path || '';
            const isSaved = !!offlineMap[path];
            const isPending = pendingPath === path;
            return (
              <li key={index} className="resource-item">
                <div className="resource-item-text">
                  <span className="resource-item-name">{item.name || item}</span>
                  {item.description && <span className="resource-item-description">{item.description}</span>}
                </div>
                <div className="resource-item-actions">
                  {isOfflineSupported() && path && (
                    <button
                      className={`offline-toggle-btn ${isSaved ? 'saved' : ''}`}
                      onClick={(e) => handleToggleOffline(e, item)}
                      disabled={isPending}
                      title={isSaved ? 'Remove from offline library' : 'Save for offline use'}
                      aria-label={isSaved ? 'Remove from offline library' : 'Save for offline use'}
                    >
                      {isPending ? (
                        <HourglassEmpty sx={{ fontSize: 18 }} />
                      ) : isSaved ? (
                        <CloudDone sx={{ fontSize: 18 }} />
                      ) : (
                        <CloudDownload sx={{ fontSize: 18 }} />
                      )}
                    </button>
                  )}
                  <button onClick={() => onItemClick(item)}>View</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="no-resources">No resources available</p>
      )}
      {footer}
    </div>
  )
}

export default ResourceList
