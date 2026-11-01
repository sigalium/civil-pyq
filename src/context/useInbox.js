import { createContext, useContext } from 'react'

export const InboxContext = createContext(null)

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be used within an InboxProvider')
  return ctx
}
