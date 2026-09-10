import { useEffect, useRef } from 'react';
import { usePDFWindows } from '../context/usePDFWindows';
import { useResourcesData } from '../context/useResourcesData';

const isMobile = () => window.matchMedia('(max-width: 800px)').matches;

const PDFUrlSync = () => {
  const { windows, openPdf } = usePDFWindows();
  const { resourceRows, loading } = useResourcesData();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current || loading) return;
    restoredRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const ids = (params.get('open') || '').split(',').filter(Boolean);
    if (ids.length === 0) return;
    const toOpen = isMobile() ? ids.slice(0, 1) : ids;
    toOpen.forEach((id) => {
      const row = resourceRows.find((r) => r.id === id);
      if (row) openPdf({ name: row.name, path: row.path, resourceId: row.id });
    });
  }, [loading, resourceRows]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const ids = windows.filter((w) => w.resourceId).map((w) => w.resourceId);
    const params = new URLSearchParams(window.location.search);
    if (ids.length > 0) {
      params.set('open', ids.join(','));
    } else {
      params.delete('open');
    }
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [windows]);

  return null;
};

export default PDFUrlSync;
