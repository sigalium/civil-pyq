import { useCallback, useEffect, useRef, useState } from 'react'
import { NotificationContext } from './useNotifications'

const MAX_TOASTS = 3

function readCollapsed(key) {
  try {
    return sessionStorage.getItem(`notif_collapsed_${key}`) === 'true'
  } catch {
    return false
  }
}

function writeCollapsed(key, value) {
  try {
    sessionStorage.setItem(`notif_collapsed_${key}`, String(value))
  } catch {
    return
  }
}

function clearCollapsed(key) {
  try {
    sessionStorage.removeItem(`notif_collapsed_${key}`)
  } catch {
    return
  }
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const timers = useRef({})

  const clearTimer = (id) => {
    const timer = timers.current[id]
    if (timer) {
      clearTimeout(timer.timeoutId)
      delete timers.current[id]
    }
  }

  const dismiss = useCallback((id) => {
    clearTimer(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const scheduleTimer = useCallback((id, ms) => {
    clearTimer(id)
    const timeoutId = setTimeout(() => dismiss(id), ms)
    timers.current[id] = { timeoutId, remaining: null }
  }, [dismiss])

  const notify = useCallback(({ message, variant = 'info', actionLabel, onAction, duration }) => {
    const id = crypto.randomUUID()
    const resolvedDuration = duration ?? (actionLabel ? 8000 : 5000)
    const expiresAt = Date.now() + resolvedDuration

    setNotifications((prev) => {
      const toasts = prev.filter((n) => n.kind === 'toast')
      let base = prev
      if (toasts.length >= MAX_TOASTS) {
        const oldest = toasts[0]
        clearTimer(oldest.id)
        base = prev.filter((n) => n.id !== oldest.id)
      }
      return [...base, {
        id,
        kind: 'toast',
        variant,
        message,
        actionLabel,
        onAction,
        duration: resolvedDuration,
        expiresAt,
        paused: false,
      }]
    })

    scheduleTimer(id, resolvedDuration)
    return id
  }, [scheduleTimer])

  const pauseToast = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => {
      if (n.id !== id || n.kind !== 'toast' || n.paused) return n
      const timer = timers.current[id]
      if (timer) {
        clearTimeout(timer.timeoutId)
        timer.remaining = Math.max(n.expiresAt - Date.now(), 300)
      }
      return { ...n, paused: true }
    }))
  }, [])

  const resumeToast = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => {
      if (n.id !== id || n.kind !== 'toast' || !n.paused) return n
      const timer = timers.current[id]
      const remaining = timer?.remaining ?? n.duration
      scheduleTimer(id, remaining)
      return { ...n, paused: false, expiresAt: Date.now() + remaining }
    }))
  }, [scheduleTimer])

  const setStatus = useCallback((key, { message, variant = 'warning' } = {}) => {
    setNotifications((prev) => {
      const existing = prev.find((n) => n.id === key && n.kind === 'status')
      if (existing) {
        return prev.map((n) => (n.id === key ? { ...n, message, variant } : n))
      }
      return [{ id: key, kind: 'status', variant, message, collapsed: readCollapsed(key) }, ...prev]
    })
  }, [])

  const clearStatus = useCallback((key) => {
    setNotifications((prev) => prev.filter((n) => n.id !== key))
    clearCollapsed(key)
  }, [])

  const toggleStatusCollapsed = useCallback((key) => {
    setNotifications((prev) => prev.map((n) => {
      if (n.id !== key || n.kind !== 'status') return n
      const next = !n.collapsed
      writeCollapsed(key, next)
      return { ...n, collapsed: next }
    }))
  }, [])

  useEffect(() => () => {
    Object.values(timers.current).forEach((timer) => clearTimeout(timer.timeoutId))
  }, [])

  const value = {
    notifications,
    notify,
    dismiss,
    pauseToast,
    resumeToast,
    setStatus,
    clearStatus,
    toggleStatusCollapsed,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
