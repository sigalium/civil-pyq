import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getLocalId } from '../utils/localId'
import { InboxContext } from './useInbox'

const SEEN_KEY = 'civilpyq_inbox_seen_at'
const POLL_MS = 120000
const FEED_LIMIT = 60

function readSeen() {
  try {
    const stored = localStorage.getItem(SEEN_KEY)
    if (stored) return stored
    const now = new Date().toISOString()
    localStorage.setItem(SEEN_KEY, now)
    return now
  } catch {
    return new Date().toISOString()
  }
}

function writeSeen(value) {
  try {
    localStorage.setItem(SEEN_KEY, value)
  } catch {
    return
  }
}

function buildItems(announcements, updates) {
  const items = []
  announcements.forEach((row) => {
    items.push({
      key: `announcement-${row.id}`,
      kind: 'announcement',
      title: row.title,
      message: row.message,
      titleUnderline: !!row.title_underline,
      at: row.created_at,
    })
  })
  updates.forEach((row) => {
    items.push({
      key: `submission-${row.id}`,
      kind: row.status === 'approved' ? 'approved' : 'rejected',
      label: row.resource_label,
      reason: row.rejection_reason || '',
      at: row.reviewed_at || row.created_at,
    })
  })
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

export function InboxProvider({ children }) {
  const [announcements, setAnnouncements] = useState([])
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [seenAt, setSeenAt] = useState(readSeen)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    const localId = getLocalId()
    const fetchAnnouncements = (columns) =>
      supabase
        .from('announcements')
        .select(columns)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT)
    const [initialAnnouncementRes, updateRes] = await Promise.all([
      fetchAnnouncements('id, title, message, title_underline, created_at'),
      localId
        ? supabase.rpc('my_submissions', { p_local_id: localId, p_limit: FEED_LIMIT, p_offset: 0, p_only_reviewed: true })
        : Promise.resolve({ data: [] }),
    ])
    const announcementRes = initialAnnouncementRes.error
      ? await fetchAnnouncements('id, title, message, created_at')
      : initialAnnouncementRes
    if (!mountedRef.current) return
    if (!announcementRes.error) setAnnouncements(announcementRes.data || [])
    if (!updateRes.error) setUpdates(updateRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    const handleVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [refresh])

  const items = useMemo(() => buildItems(announcements, updates), [announcements, updates])
  const announcementItems = useMemo(() => buildItems(announcements, []), [announcements])
  const personalItems = useMemo(() => buildItems([], updates), [updates])

  const hasUnread = useMemo(() => {
    const seen = Date.parse(seenAt)
    return items.some((item) => Date.parse(item.at) > seen)
  }, [items, seenAt])

  const markAllSeen = useCallback(() => {
    const newest = items.length ? Date.parse(items[0].at) : 0
    const next = new Date(Math.max(Date.now(), newest)).toISOString()
    writeSeen(next)
    setSeenAt(next)
  }, [items])

  return (
    <InboxContext.Provider value={{ items, announcementItems, personalItems, loading, hasUnread, seenAt, markAllSeen, refresh }}>
      {children}
    </InboxContext.Provider>
  )
}
