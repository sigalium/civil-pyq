import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookmarksContext } from './useBookmarks'

const STORAGE_KEY = 'civilpyq_bookmarks_v1'

function readBookmarks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.path && item.name) : []
  } catch {
    return []
  }
}

export function BookmarksProvider({ children }) {
  const [bookmarks, setBookmarks] = useState(readBookmarks)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
    } catch {
      return
    }
  }, [bookmarks])

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEY) setBookmarks(readBookmarks())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const paths = useMemo(() => new Set(bookmarks.map((item) => item.path)), [bookmarks])

  const isBookmarked = useCallback((path) => !!path && paths.has(path), [paths])

  const toggleBookmark = useCallback(({ name, path, resourceId }) => {
    if (!path || !name) return
    setBookmarks((prev) => {
      if (prev.some((item) => item.path === path)) return prev.filter((item) => item.path !== path)
      return [{ name, path, resourceId: resourceId || null, savedAt: new Date().toISOString() }, ...prev]
    })
  }, [])

  const removeBookmark = useCallback((path) => {
    setBookmarks((prev) => prev.filter((item) => item.path !== path))
  }, [])

  return (
    <BookmarksContext.Provider value={{ bookmarks, isBookmarked, toggleBookmark, removeBookmark }}>
      {children}
    </BookmarksContext.Provider>
  )
}
