import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabaseClient'
import '../../components/css/SignOutConfirmModal.css'

async function readError(error) {
  try {
    const body = await error.context.json()
    return body.error || body.message || error.message
  } catch {
    return error.message
  }
}

const EmergencyCleanupModal = ({ onClose, onDone }) => {
  const [reason, setReason] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [waiting, setWaiting] = useState(null)
  const [finished, setFinished] = useState(false)

  const ready = confirm === 'CLEAN' && (waiting || reason.trim().length >= 5)

  const start = async () => {
    setBusy(true)
    setMessage('')
    const { data, error } = await supabase.functions.invoke('history-cleanup', {
      body: { confirm, reason: reason.trim(), dry_run: dryRun, run_id: waiting ? waiting.runId : undefined },
    })
    setBusy(false)
    if (error) {
      setMessage(await readError(error))
      return
    }
    if (data.status === 'waiting') {
      setWaiting({ runId: data.runId })
      setMessage(data.message)
      return
    }
    setWaiting(null)
    setMessage(data.message)
    setFinished(true)
    onDone()
  }

  return createPortal(
    <div className="confirm-modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Emergency cleanup</h3>
        {finished ? (
          <p className="emergency-message">{message}</p>
        ) : (
          <>
            <p className="confirm-modal-hint">Pauses the dashboard right away.</p>
            {!waiting && (
              <textarea
                className="confirm-modal-textarea"
                rows={3}
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason"
                disabled={busy}
              />
            )}
            <label className="emergency-check">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} disabled={busy || !!waiting} />
              Test run only
            </label>
            <input
              className="emergency-confirm-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type CLEAN to confirm"
              disabled={busy}
            />
            {message && <p className="emergency-message">{message}</p>}
          </>
        )}
        <div className="confirm-modal-actions">
          <button className="confirm-modal-btn cancel" onClick={onClose} disabled={busy}>
            {finished ? 'Close' : 'Cancel'}
          </button>
          {!finished && (
            <button className="confirm-modal-btn confirm danger" onClick={start} disabled={busy || !ready}>
              {busy ? 'Working…' : waiting ? 'Retry' : dryRun ? 'Start test' : 'Start'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EmergencyCleanupModal
