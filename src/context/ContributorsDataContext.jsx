import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ContributorsDataContext } from './useContributorsData'

export function ContributorsDataProvider({ children }) {
  const [contributorRows, setContributorRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const initializedRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!initializedRef.current) setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('contributors')
      .select('*')
      .order('sort_order')

    if (fetchError) {
      setError('Could not load contributors right now.')
      setLoading(false)
      return
    }

    setContributorRows(data || [])
    setLoading(false)
    initializedRef.current = true
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <ContributorsDataContext.Provider value={{ contributorRows, loading, error, refresh }}>
      {children}
    </ContributorsDataContext.Provider>
  )
}
