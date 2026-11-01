import { useEffect } from 'react'
import { Wrench } from 'lucide-react'
import { useCleanup } from '../context/useCleanup'
import { useNotifications } from '../context/useNotifications'
import { formatIstTime } from '../utils/istTime'
import { repoIdle, repoIdleText, repoIdleTitle } from '../utils/repoActivity'

const TOAST_KEY = 'civilpyq_cleanup_toasts'

function readShown() {
  try {
    return JSON.parse(localStorage.getItem(TOAST_KEY) || '[]')
  } catch {
    return []
  }
}

function markShown(key) {
  try {
    const next = [...readShown().filter((item) => item !== key), key].slice(-12)
    localStorage.setItem(TOAST_KEY, JSON.stringify(next))
  } catch {
    return
  }
}

const CleanupNotices = () => {
  const { status, stage } = useCleanup()
  const { notify, setStatus, clearStatus } = useNotifications()
  const runKey = status?.next_run_month ? `${status.next_run_month}-${status.next_kind}` : ''
  const startLabel = formatIstTime(status?.next_lock_start)
  const endLabel = formatIstTime(status?.ends_at || status?.next_lock_end)
  const windowLabel = `${startLabel} to ${formatIstTime(status?.next_lock_end)} IST`

  useEffect(() => {
    if (stage === 'locked') {
      setStatus('cleanup', { variant: 'warning', message: `Dashboard paused until ${endLabel} IST`, icon: <Wrench size={14} /> })
      return () => clearStatus('cleanup')
    }
    if (stage === 'two_hours') {
      setStatus('cleanup', { variant: 'warning', message: `Dashboard pauses at ${startLabel} IST`, icon: <Wrench size={14} /> })
      return () => clearStatus('cleanup')
    }
    clearStatus('cleanup')
    return undefined
  }, [stage, startLabel, endLabel, setStatus, clearStatus])

  useEffect(() => {
    if (!runKey) return
    if (stage !== 'day_before' && stage !== 'two_hours') return
    const key = `${runKey}-${stage}`
    if (readShown().includes(key)) return
    markShown(key)
    notify({
      variant: stage === 'day_before' ? 'info' : 'warning',
      message: stage === 'day_before' ? `Dashboard paused tomorrow, ${windowLabel}.` : `Dashboard pauses at ${startLabel} IST.`,
      duration: 12000,
    })
  }, [stage, runKey, startLabel, windowLabel, notify])

  const idlePushedAt = status?.settings?.repo_pushed_at || ''

  useEffect(() => {
    if (!idlePushedAt) return
    const idle = repoIdle({ settings: { repo_pushed_at: idlePushedAt } })
    if (!idle) return
    const key = `repo-idle-${idle.level}-${idlePushedAt}`
    if (readShown().includes(key)) return
    markShown(key)
    notify({
      variant: idle.level === 'over' ? 'error' : 'warning',
      message: `${repoIdleTitle(idle)}. ${repoIdleText(idle)}`,
      duration: 12000,
    })
  }, [idlePushedAt, notify])

  return null
}

export default CleanupNotices
