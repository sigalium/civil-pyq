import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'
import { CleanupContext } from './useCleanup'

const POLL_MS = 60000

export function CleanupProvider({ children }) {
  const { status: authStatus } = useAuth()
  const isAdmin = authStatus === 'admin'
  const [data, setData] = useState(null)

  const refresh = useCallback(async () => {
    if (!isAdmin) return
    const { data: result } = await supabase.rpc('cleanup_status')
    setData(result || null)
  }, [isAdmin])

  useEffect(() => {
    refresh()
    if (!isAdmin) return undefined
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    const handleVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [isAdmin, refresh])

  const status = isAdmin ? data : null

  return (
    <CleanupContext.Provider
      value={{
        status,
        refresh,
        locked: !!status?.locked,
        stage: status?.stage || 'none',
        canControl: !!status?.can_control,
      }}
    >
      {children}
    </CleanupContext.Provider>
  )
}
