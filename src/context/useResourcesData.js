import { createContext, useContext } from 'react'

export const ResourcesDataContext = createContext(null)

export function useResourcesData() {
  const ctx = useContext(ResourcesDataContext)
  if (!ctx) throw new Error('useResourcesData must be used within a ResourcesDataProvider')
  return ctx
}
