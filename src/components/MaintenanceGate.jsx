import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useResourcesData } from '../context/useResourcesData'
import MaintenancePage from '../pages/MaintenancePage'
import MaintenanceAdminBadge from './MaintenanceAdminBadge'

const MaintenanceGate = ({ children }) => {
  const { status } = useAuth()
  const { maintenanceActive, maintenanceUntil, maintenanceMessage } = useResourcesData()
  const location = useLocation()
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const isOfflineLibraryRoute = location.pathname.startsWith('/offline-library')

  if (!maintenanceActive || isDashboardRoute || isOfflineLibraryRoute) {
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
