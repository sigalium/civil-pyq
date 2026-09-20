import { useEffect } from 'react'
import { Wrench } from 'lucide-react'
import { useNotifications } from '../context/useNotifications'

const MaintenanceAdminBadge = () => {
  const { setStatus, clearStatus } = useNotifications()

  useEffect(() => {
    setStatus('maintenance', {
      variant: 'warning',
      message: 'Maintenance mode is on',
      icon: <Wrench size={14} />,
    })
    return () => clearStatus('maintenance')
  }, [setStatus, clearStatus])

  return null
}

export default MaintenanceAdminBadge
