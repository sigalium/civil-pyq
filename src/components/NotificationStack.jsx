import { useEffect, useState } from 'react'
import { X, ChevronsDown } from 'lucide-react'
import { useNotifications } from '../context/useNotifications'
import './css/NotificationStack.css'

const StatusPill = ({ item, onToggle }) => {
  if (item.collapsed) {
    return (
      <button
        type="button"
        className={`notification-status-icon notification-${item.variant}`}
        onClick={onToggle}
        aria-label={item.message}
        title={item.message}
      >
        {item.icon || <span className="notification-status-dot" />}
      </button>
    )
  }

  return (
    <div className={`notification-status notification-${item.variant}`} role="status">
      {item.icon ? <span className="notification-status-glyph">{item.icon}</span> : <span className="notification-status-dot" />}
      <span className="notification-status-message">{item.message}</span>
      <button type="button" className="notification-collapse-btn" onClick={onToggle} aria-label="Hide">
        <ChevronsDown size={14} />
      </button>
    </div>
  )
}

const Toast = ({ item, onDismiss, onPause, onResume }) => {
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    if (item.paused) return undefined
    let raf
    const tick = () => {
      const pct = Math.max(0, (item.expiresAt - Date.now()) / item.duration)
      setProgress(pct)
      if (pct > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [item.paused, item.expiresAt, item.duration])

  return (
    <div
      className={`notification-toast notification-${item.variant}`}
      role={item.variant === 'error' ? 'alert' : 'status'}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
    >
      <div className="notification-toast-body">
        <span className="notification-toast-message">{item.message}</span>
        <div className="notification-toast-actions">
          {item.actionLabel && (
            <button
              type="button"
              className="notification-toast-action"
              onClick={() => { item.onAction?.(); onDismiss() }}
            >
              {item.actionLabel}
            </button>
          )}
          <button type="button" className="notification-toast-close" onClick={onDismiss} aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="notification-toast-bar" style={{ width: `${progress * 100}%` }} />
    </div>
  )
}

const NotificationStack = () => {
  const { notifications, dismiss, pauseToast, resumeToast, toggleStatusCollapsed } = useNotifications()

  if (notifications.length === 0) return null

  return (
    <div className="notification-stack" aria-live="polite">
      {notifications.map((item) => (
        item.kind === 'status' ? (
          <StatusPill key={item.id} item={item} onToggle={() => toggleStatusCollapsed(item.id)} />
        ) : (
          <Toast
            key={item.id}
            item={item}
            onDismiss={() => dismiss(item.id)}
            onPause={() => pauseToast(item.id)}
            onResume={() => resumeToast(item.id)}
          />
        )
      ))}
    </div>
  )
}

export default NotificationStack
