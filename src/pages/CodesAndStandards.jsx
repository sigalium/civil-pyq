import { useState } from 'react';
import { useResourcesData } from '../context/useResourcesData';
import { usePDFWindows } from '../context/usePDFWindows';
import { useNavigate, useLocation } from 'react-router-dom';
import BackButton from '../components/BackButton';
import ResourceList from '../components/ResourceList';
import './styles/Resources.css';

const PAGE_SIZE = 10;

const CodesAndStandards = () => {
  const { isCodes, sections, loading, error } = useResourcesData();
  const { openPdf } = usePDFWindows();
  const navigate = useNavigate();
  const location = useLocation();
  const [visibleCounts, setVisibleCounts] = useState({});

  const handleClick = (item) => {
    openPdf({ name: item.name, path: item.path, resourceId: item.id });
  };

  const showMore = (key) => {
    setVisibleCounts((prev) => ({ ...prev, [key]: (prev[key] || PAGE_SIZE) + PAGE_SIZE }));
  };

  const backTo = location.state?.from || '/resources';

  const grouped = sections.map((section) => ({
    key: section.id,
    title: section.name,
    items: isCodes.filter((item) => item.section_id === section.id),
  }));
  const uncategorized = isCodes.filter((item) => !item.section_id || !sections.some((s) => s.id === item.section_id));
  if (uncategorized.length > 0) {
    grouped.push({ key: 'other', title: sections.length > 0 ? 'Other' : '', items: uncategorized });
  }

  return (
    <div className="resources fade-in iscodes-page">
      <div className="resources-container">
        <BackButton onClick={() => navigate(backTo)} text="Back" className="back-btn-page-top" />
        <h2 className="select-semester-heading">Codes & Standards</h2>
        {loading ? (
          <p className="no-resources">Loading…</p>
        ) : error ? (
          <p className="no-resources">{error}</p>
        ) : isCodes.length === 0 ? (
          <p className="no-resources">Nothing added yet.</p>
        ) : (
          grouped.map(({ key, title, items }) => {
            const visibleCount = visibleCounts[key] || PAGE_SIZE;
            const visibleItems = items.slice(0, visibleCount);
            const hasMore = items.length > visibleCount;
            return (
              items.length > 0 && (
                <div key={key} className="codes-section-block">
                  <ResourceList
                    title={title}
                    items={visibleItems}
                    onItemClick={handleClick}
                    subject="Codes & Standards"
                    footer={
                      hasMore && (
                        <button type="button" className="codes-show-more-btn" onClick={() => showMore(key)}>
                          Show more
                        </button>
                      )
                    }
                  />
                </div>
              )
            );
          })
        )}
      </div>
    </div>
  );
};

export default CodesAndStandards;
