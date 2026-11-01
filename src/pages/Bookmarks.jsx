import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import BackButton from '../components/BackButton'
import ConfirmModal from '../components/ConfirmModal'
import { useBookmarks } from '../context/useBookmarks'
import { usePDFWindows } from '../context/usePDFWindows'
import './styles/UserLists.css'

const Bookmarks = () => {
  const navigate = useNavigate()
  const { bookmarks, removeBookmark } = useBookmarks()
  const { openPdf } = usePDFWindows()
  const [removeTarget, setRemoveTarget] = useState(null)

  return (
    <div className="user-list-page fade-in">
      <div className="user-list-container">
        <BackButton onClick={() => navigate('/')} text="Home" className="back-btn-page-top" />
        <h2 className="user-list-title">Bookmarks</h2>

        {bookmarks.length === 0 ? (
          <p className="user-list-empty">No bookmarks yet.</p>
        ) : (
          <div className="user-list">
            {bookmarks.map((item) => (
              <div className="user-list-item bookmark-item" key={item.path}>
                <div className="user-list-body">
                  <span className="bookmark-name">{item.name}</span>
                </div>
                <div className="bookmark-actions">
                  <button
                    type="button"
                    className="bookmark-remove"
                    onClick={() => setRemoveTarget(item)}
                    aria-label="Remove bookmark"
                    title="Remove bookmark"
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                  </button>
                  <button
                    type="button"
                    className="bookmark-open"
                    onClick={() => openPdf({ name: item.name, path: item.path, resourceId: item.resourceId || undefined })}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {removeTarget && (
        <ConfirmModal
          title="Remove this bookmark?"
          message={removeTarget.name}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          onConfirm={() => {
            removeBookmark(removeTarget.path)
            setRemoveTarget(null)
          }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}

export default Bookmarks
