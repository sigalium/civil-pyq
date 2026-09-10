import { createPortal } from 'react-dom'
import './css/SignOutConfirmModal.css'

const ConfirmModal = ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true, onConfirm, onCancel }) => createPortal(
  <div className="confirm-modal-overlay" onClick={onCancel}>
    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
      <h3>{title}</h3>
      {message && <p className="confirm-modal-hint">{message}</p>}
      <div className="confirm-modal-actions">
        <button className="confirm-modal-btn cancel" onClick={onCancel}>{cancelLabel}</button>
        <button className={`confirm-modal-btn ${danger ? 'confirm' : 'confirm-safe'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>,
  document.body
)

export default ConfirmModal
