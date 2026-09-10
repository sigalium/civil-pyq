import { useResourcesData } from '../context/useResourcesData'
import './css/OfflineDataBadge.css'

function formatCachedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const OfflineDataBadge = () => {
  const { usingCachedData, cachedAt } = useResourcesData()

  if (!usingCachedData) return null

  const savedAt = formatCachedAt(cachedAt)

  return (
    <div className="offline-data-badge">
      <span className="offline-data-badge-dot" />
      <span>
        We can't reach our servers right now, so you're seeing a saved copy of the site
        {savedAt ? ` from ${savedAt}` : ''}.
      </span>
    </div>
  )
}

export default OfflineDataBadge
