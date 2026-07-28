import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import type { Profile, UserRole } from '../types'

function CenteredPanel({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <section className="panel status-panel">{children}</section>
    </div>
  )
}

// Where each role's portal actually lives - used to send a signed-in user to
// their own portal, whichever of the (now three) roles they turn out to be.
const PORTALS_BY_ROLE: Record<UserRole, { path: string; label: string }> = {
  worker: { path: '/', label: 'worker' },
  owner: { path: '/owner', label: 'owner' },
  learner: { path: '/learn', label: 'learner' },
  developer: { path: '/dev', label: 'developer' },
}

export function AuthGate({
  expectedRole,
  loginPath,
  children,
}: {
  expectedRole: UserRole
  loginPath: string
  children: (profile: Profile) => ReactNode
}) {
  const { configured, loading, session, profile, profileError, signOut } = useAuth()

  if (!configured) {
    return (
      <CenteredPanel>
        <h2>Supabase not configured</h2>
        <p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment, then reload.</p>
      </CenteredPanel>
    )
  }

  if (loading) {
    return (
      <CenteredPanel>
        <p className="info-text">Loading your account…</p>
      </CenteredPanel>
    )
  }

  if (!session) {
    return <Navigate to={loginPath} replace />
  }

  if (profileError || !profile) {
    return (
      <CenteredPanel>
        <h2>We can't find your account</h2>
        <p>{profileError ?? 'Ask your employer to add you before signing in.'}</p>
        <button type="button" className="btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </CenteredPanel>
    )
  }

  if (profile.role !== expectedRole) {
    const target = PORTALS_BY_ROLE[profile.role]
    if (!target) {
      // Shouldn't happen (the role column is constrained at the DB level),
      // but degrade gracefully instead of crashing the whole app if it ever does.
      console.error(`AuthGate: profile has unrecognized role "${String(profile.role)}"`)
    }
    return (
      <CenteredPanel>
        <h2>Wrong portal</h2>
        {target ? (
          <>
            <p>This login belongs to the {target.label} portal.</p>
            <a className="btn-primary" href={target.path}>
              Go to {target.label} portal
            </a>
          </>
        ) : (
          <p>This account isn't set up for this portal. Contact your employer for help.</p>
        )}
        <button type="button" className="btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </CenteredPanel>
    )
  }

  if (profile.status === 'suspended') {
    return (
      <CenteredPanel>
        <h2>Account suspended</h2>
        <p>Your access has been paused. Contact your employer for details.</p>
        <button type="button" className="btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </CenteredPanel>
    )
  }

  if (profile.status === 'removed') {
    return (
      <CenteredPanel>
        <h2>Account no longer active</h2>
        <p>This account has been removed. Contact your employer if this is unexpected.</p>
        <button type="button" className="btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </CenteredPanel>
    )
  }

  return <>{children(profile)}</>
}
