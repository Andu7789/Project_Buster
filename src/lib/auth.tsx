import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'
import { findOrClaimProfile } from '../data/queries'
import type { Profile } from '../types'
import { AuthContext, type AuthContextValue } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(() => isSupabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [recoveryMode, setRecoveryMode] = useState(false)

  async function loadProfile(nextSession: Session | null) {
    if (!nextSession) {
      setProfile(null)
      setProfileError(null)
      return
    }

    try {
      const found = await findOrClaimProfile(nextSession.user.id)
      setProfile(found)
      setProfileError(found ? null : 'No account is set up for this email yet. Ask your employer to add you first.')
    } catch (err) {
      setProfile(null)
      setProfileError(err instanceof Error ? err.message : 'Could not load your account.')
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    let cancelled = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      await loadProfile(data.session)
      if (!cancelled) setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'SIGNED_OUT') setRecoveryMode(false)
      setSession(nextSession)
      setLoading(true)
      await loadProfile(nextSession)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextValue = {
    configured: isSupabaseConfigured,
    loading,
    session,
    profile,
    profileError,
    recoveryMode,
    async signIn(email, password) {
      if (!supabase) return { error: 'Supabase is not configured.' }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
    },
    async signUp(email, password) {
      if (!supabase) return { error: 'Supabase is not configured.' }
      const { error } = await supabase.auth.signUp({ email, password })
      return { error: error?.message ?? null }
    },
    async signOut() {
      if (!supabase) return
      await supabase.auth.signOut()
    },
    async refreshProfile() {
      await loadProfile(session)
    },
    async completePasswordReset(password) {
      if (!supabase) return { error: 'Supabase is not configured.' }
      const { error } = await supabase.auth.updateUser({ password })
      if (!error) setRecoveryMode(false)
      return { error: error?.message ?? null }
    },
    async requestPasswordReset(email) {
      if (!supabase) return { error: 'Supabase is not configured.' }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      return { error: error?.message ?? null }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
