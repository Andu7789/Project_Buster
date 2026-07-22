import { useAuth } from '../lib/authContext'
import type { Profile } from '../types'
import { PortalHeader } from '../components/PortalHeader'
import { TrainingPortal } from '../components/TrainingPortal'

export function LearnerDashboard({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()

  return (
    <div style={{ paddingTop: 'var(--header-height)' }}>
      <PortalHeader portalLabel="Learner portal" userName={profile.full_name} onSignOut={signOut} />
      <TrainingPortal />
    </div>
  )
}
