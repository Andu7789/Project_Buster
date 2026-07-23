import { useAuth } from '../lib/authContext'
import { AuthForm } from '../components/AuthForm'
import { AuthGate } from '../components/AuthGate'
import { OwnerDashboard } from './OwnerDashboard'

export function OwnerPortal() {
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
        <AuthForm
          portalLabel="Owner sign in"
          portalHint="Review submissions and manage your team."
        />
      </div>
    )
  }

  return (
    <AuthGate expectedRole="owner" loginPath="/owner">
      {(profile) => <OwnerDashboard profile={profile} />}
    </AuthGate>
  )
}
