import { useEffect, useState } from 'react'
import { useCleanup } from '../context/useCleanup'
import { formatCountdown, formatIstDate, formatIstTime, formatSizeKb } from '../utils/istTime'
import { repoIdle, repoIdleText, repoIdleTitle } from '../utils/repoActivity'
import './css/CleanupBanner.css'

const AFTER_KEY = 'civilpyq_cleanup_after_dismissed'
const RECENT_MS = 3 * 24 * 3600 * 1000
const TOKEN_WARN_MS = 14 * 24 * 3600 * 1000

const CleanupBanner = () => {
  const { status, stage, canControl } = useCleanup()
  const [now, setNow] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(AFTER_KEY) || ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    if (stage !== 'locked' && stage !== 'two_hours') return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [stage])

  if (!status) return null

  const banners = []

  if (stage === 'day_before') {
    banners.push({
      key: 'day_before',
      tone: 'info',
      title: 'Cleanup tomorrow',
      text: `Dashboard paused ${formatIstTime(status.next_lock_start)} to ${formatIstTime(status.next_lock_end)} IST.`,
    })
  }

  if (stage === 'two_hours') {
    banners.push({
      key: 'two_hours',
      tone: 'warning',
      title: `Pauses in ${formatCountdown(Date.parse(status.next_lock_start) - now)}`,
      text: `Finish uploads before ${formatIstTime(status.next_lock_start)} IST.`,
    })
  }

  if (stage === 'locked') {
    banners.push({
      key: 'locked',
      tone: 'lock',
      title: status.reason === 'emergency' ? 'Emergency cleanup' : 'Dashboard paused',
      text: `Back at ${formatIstTime(status.ends_at)} IST, in ${formatCountdown(Date.parse(status.ends_at) - now)}.`,
    })
  }

  const last = status.last_run
  if (last && last.finished_at && now - Date.parse(last.finished_at) < RECENT_MS && dismissed !== last.finished_at) {
    if (last.status === 'succeeded' && !last.dry_run) {
      banners.push({
        key: 'after',
        tone: 'success',
        title: 'Cleanup finished',
        text:
          last.repo_size_before_kb && last.repo_size_after_kb
            ? `Repository ${formatSizeKb(last.repo_size_before_kb)} to ${formatSizeKb(last.repo_size_after_kb)}.`
            : 'New size appears tomorrow.',
        dismiss: last.finished_at,
      })
    } else if (last.status === 'failed' || last.status === 'rolled_back') {
      banners.push({
        key: 'failed',
        tone: 'error',
        title: last.status === 'rolled_back' ? 'Cleanup rolled back' : 'Cleanup failed',
        text: 'No data lost. See Log.',
        dismiss: last.finished_at,
      })
    }
  }

  if (canControl && status.settings?.token_expires_at) {
    const left = Date.parse(status.settings.token_expires_at) - now
    if (left < TOKEN_WARN_MS) {
      banners.push({
        key: 'token',
        tone: left < 0 ? 'error' : 'warning',
        title: left < 0 ? 'GitHub token expired' : 'GitHub token expires soon',
        text: `Expires ${formatIstDate(status.settings.token_expires_at)}.`,
      })
    }
  }

  const idle = repoIdle(status, now)
  if (idle) {
    banners.push({
      key: 'repo_idle',
      tone: idle.level === 'over' ? 'error' : 'warning',
      title: repoIdleTitle(idle),
      text: repoIdleText(idle),
    })
  }

  if (!banners.length) return null

  return (
    <div className="cleanup-banners">
      {banners.map((banner) => (
        <div className={`cleanup-banner ${banner.tone}`} key={banner.key} role="status">
          <div className="cleanup-banner-text">
            <strong>{banner.title}</strong>
            <span>{banner.text}</span>
          </div>
          {banner.dismiss && (
            <button
              type="button"
              className="cleanup-banner-close"
              aria-label="Dismiss"
              onClick={() => {
                try {
                  localStorage.setItem(AFTER_KEY, banner.dismiss)
                } catch {
                  void banner
                }
                setDismissed(banner.dismiss)
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default CleanupBanner
