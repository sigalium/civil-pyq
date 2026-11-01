import { createContext, useContext } from 'react'

export const CleanupContext = createContext(null)

export function useCleanup() {
  const ctx = useContext(CleanupContext)
  if (!ctx) throw new Error('useCleanup must be used within a CleanupProvider')
  return ctx
}
