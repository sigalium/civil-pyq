import { useEffect } from 'react'
import { useResourcesData } from '../context/useResourcesData'
import { useNotifications } from '../context/useNotifications'

function formatCachedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const OfflineDataBadge = () => {
  const { usingCachedData, cachedAt } = useResourcesData()
  const { setStatus, clearStatus } = useNotifications()

  useEffect(() => {
    if (!usingCachedData) {
      clearStatus('offline')
      return
    }
    const savedAt = formatCachedAt(cachedAt)
    setStatus('offline', {
      variant: 'warning',
      message: `We can't reach our servers right now, so you're seeing a saved copy of the site${savedAt ? ` from ${savedAt}` : ''}.`,
    })
  }, [usingCachedData, cachedAt, setStatus, clearStatus])

  return null
}

export default OfflineDataBadge
