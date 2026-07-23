import { useAuth } from '../lib/authContext'
import { AuthForm } from '../components/AuthForm'
import { AuthGate } from '../components/AuthGate'
import { WorkerDashboard } from './WorkerDashboard'

export function WorkerPortal() {
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
          portalLabel="Contractor sign in"
        />
      </div>
    )
  }

  return (
    <AuthGate expectedRole="worker" loginPath="/">
      {(profile) => <WorkerDashboard profile={profile} />}
    </AuthGate>
  )
}
