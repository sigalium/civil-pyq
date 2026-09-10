import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useResourcesData } from '../context/useResourcesData'
import { supabase } from '../lib/supabaseClient'
import MaintenancePage from '../pages/MaintenancePage'
import MaintenanceAdminBadge from './MaintenanceAdminBadge'

const MaintenanceGate = ({ children }) => {
  const { status } = useAuth()
  const { maintenanceMode, maintenanceUntil, maintenanceMessage, maintenanceAutoOff, refresh } = useResourcesData()
  const location = useLocation()
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const isOfflineLibraryRoute = location.pathname.startsWith('/offline-library')
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (status !== 'admin' || !maintenanceMode || !maintenanceAutoOff || !maintenanceUntil || attemptedRef.current) return
    if (new Date(maintenanceUntil).getTime() > Date.now()) return
    attemptedRef.current = true
    supabase.from('global_resources').upsert({ key: 'maintenance_mode', value: 'false' }).then(() => refresh())
  }, [status, maintenanceMode, maintenanceAutoOff, maintenanceUntil, refresh])

  if (!maintenanceMode || isDashboardRoute || isOfflineLibraryRoute) {
    return children
  }

  if (status === 'loading') {
    return null
  }

  if (status === 'admin') {
    return (
      <>
        {children}
        <MaintenanceAdminBadge />
      </>
    )
  }

  return <MaintenancePage message={{ text: maintenanceMessage, until: maintenanceUntil }} />
}

export default MaintenanceGate
