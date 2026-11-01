import { createContext, useContext } from 'react'

export const BookmarksContext = createContext(null)

export function useBookmarks() {
  const ctx = useContext(BookmarksContext)
  if (!ctx) throw new Error('useBookmarks must be used within a BookmarksProvider')
  return ctx
}
