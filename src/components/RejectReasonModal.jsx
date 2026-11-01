import { useState } from 'react'
import { createPortal } from 'react-dom'
import './css/SignOutConfirmModal.css'

const MAX_REASON = 300

const RejectReasonModal = ({ label, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('')

  return createPortal(
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Reject submission</h3>
        <p className="confirm-modal-hint">{label}</p>
        <textarea
          className="confirm-modal-textarea"
          value={reason}
          maxLength={MAX_REASON}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason shown to the contributor (optional)"
          rows={4}
          autoFocus
        />
        <span className="confirm-modal-counter">{reason.length}/{MAX_REASON}</span>
        <div className="confirm-modal-actions">
          <button className="confirm-modal-btn cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-modal-btn confirm" onClick={() => onConfirm(reason.trim())}>Reject</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RejectReasonModal
