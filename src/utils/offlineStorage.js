export const CACHE_NAME = 'civilpyq-offline-v1';
const INDEX_KEY = 'civilpyq-offline-index';

export const isOfflineSupported = () =>
  typeof window !== 'undefined' && 'caches' in window;

function readIndex() {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeIndex(index) {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    return;
  }
}

export function listOfflineItems() {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt);
}

export function isSavedOffline(path) {
  return readIndex().some((item) => item.path === path);
}

export async function saveOffline({ path, name, subject, type }) {
  if (!path) throw new Error('Missing file path');
  if (!isOfflineSupported()) {
    throw new Error('Offline storage is not supported in this browser');
  }

  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(path);
  if (!response.ok) throw new Error('Could not download this file');

  const sizeBlob = await response.clone().blob();
  await cache.put(path, response);

  const index = readIndex();
  const filtered = index.filter((item) => item.path !== path);
  filtered.push({
    path,
    name: name || path.split('/').pop(),
    subject: subject || '',
    type: type || 'document',
    size: sizeBlob.size,
    savedAt: Date.now(),
  });
  writeIndex(filtered);

  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch { return; }
  }
}

export async function removeOffline(path) {
  if (isOfflineSupported()) {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(path);
  }
  writeIndex(readIndex().filter((item) => item.path !== path));
}

export async function clearAllOffline() {
  const index = readIndex();
  if (isOfflineSupported()) {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(index.map((item) => cache.delete(item.path)));
  }
  writeIndex([]);
}

export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      return await navigator.storage.estimate();
    } catch {
      return null;
    }
  }
  return null;
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        return;
      });
    });
  }
}
