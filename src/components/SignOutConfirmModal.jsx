import { createPortal } from 'react-dom'
import './css/SignOutConfirmModal.css'

const SignOutConfirmModal = ({ onConfirm, onCancel }) => createPortal(
  <div className="confirm-modal-overlay" onClick={onCancel}>
    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
      <h3>Sign out?</h3>
      <p className="confirm-modal-hint">You'll need to sign back in to access the dashboard.</p>
      <div className="confirm-modal-actions">
        <button className="confirm-modal-btn cancel" onClick={onCancel}>Cancel</button>
        <button className="confirm-modal-btn confirm" onClick={onConfirm}>Sign out</button>
      </div>
    </div>
  </div>,
  document.body
)

export default SignOutConfirmModal
