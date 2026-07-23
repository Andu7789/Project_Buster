import { useAuth } from '../lib/authContext'
import { AuthForm } from '../components/AuthForm'
import { AuthGate } from '../components/AuthGate'
import { LearnerDashboard } from './LearnerDashboard'

export function LearnerPortal() {
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
          portalLabel="Learner sign in"
        />
      </div>
    )
  }

  return (
    <AuthGate expectedRole="learner" loginPath="/learn">
      {(profile) => <LearnerDashboard profile={profile} />}
    </AuthGate>
  )
}
