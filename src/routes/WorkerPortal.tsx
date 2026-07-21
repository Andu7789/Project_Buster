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
          portalLabel="Worker sign in"
          portalHint="Enter the amount for whichever days you worked."
          otherPortalPath="/owner"
          otherPortalPrompt="Are you the owner? Sign in here"
        />
      </div>
    )
  }

  return (
    <AuthGate expectedRole="worker" loginPath="/" otherPortalPath="/owner" otherPortalLabel="owner">
      {(profile) => <WorkerDashboard profile={profile} />}
    </AuthGate>
  )
}
