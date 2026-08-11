import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function evaluate(currentSession) {
      if (!currentSession) {
        if (isMounted) {
          setSession(null)
          setProfile(null)
          setStatus('signed-out')
        }
        return
      }

      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', currentSession.user.email)
        .maybeSingle()

      if (!isMounted) return

      if (error || !data) {
        setSession(null)
        setProfile(null)
        setStatus('unauthorized')
        await supabase.auth.signOut()
        return
      }

      setSession(currentSession)
      setProfile(data)
      setStatus('admin')
    }

    supabase.auth.getSession().then(({ data }) => evaluate(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      evaluate(newSession)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ status, session, profile, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
