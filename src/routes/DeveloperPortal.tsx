import { useAuth } from '../lib/authContext'
import { AuthForm } from '../components/AuthForm'
import { AuthGate } from '../components/AuthGate'
import { DeveloperDashboard } from './DeveloperDashboard'

export function DeveloperPortal() {
  const { loading, session } = useAuth()

  if (loading) {
    return (
      <div className="app-shell app-shell-center">
        <p className="info-text">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="app-shell app-shell-center">
        <AuthForm portalLabel="Developer sign in" />
      </div>
    )
  }

  return (
    <AuthGate expectedRole="developer" loginPath="/dev">
      {(profile) => <DeveloperDashboard profile={profile} />}
    </AuthGate>
  )
}
