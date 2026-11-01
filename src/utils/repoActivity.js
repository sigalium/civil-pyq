export const REPO_WARN_DAYS = 50
export const REPO_LIMIT_DAYS = 60

const DAY_MS = 24 * 3600 * 1000

export function repoIdle(status, now = Date.now()) {
  const at = status?.settings?.repo_pushed_at
  if (!at) return null
  const days = Math.floor((now - Date.parse(at)) / DAY_MS)
  if (!Number.isFinite(days) || days < REPO_WARN_DAYS) return null
  return { days, at, level: days >= REPO_LIMIT_DAYS ? 'over' : 'warn' }
}

export function repoIdleTitle(idle) {
  return `No commit for ${idle.days} days`
}

export function repoIdleText(idle) {
  return idle.level === 'over' ? 'Scheduled jobs may be off. Push a commit.' : 'GitHub pauses schedules at 60 days.'
}
