import { createContext, useContext } from 'react'

export const ContributorsDataContext = createContext(null)

export function useContributorsData() {
  const ctx = useContext(ContributorsDataContext)
  if (!ctx) throw new Error('useContributorsData must be used within a ContributorsDataProvider')
  return ctx
}
