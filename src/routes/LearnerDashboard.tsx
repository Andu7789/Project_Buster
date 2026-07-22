import { useEffect, useState } from 'react'
import { useAuth } from '../lib/authContext'
import { listTrainingProgress, markModuleComplete, resetTrainingProgress } from '../data/queries'
import type { Profile } from '../types'
import { PortalHeader } from '../components/PortalHeader'
import { TrainingPortal } from '../components/TrainingPortal'

export function LearnerDashboard({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()
  const [completedModuleIds, setCompletedModuleIds] = useState<string[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listTrainingProgress(profile.id)
      .then((rows) => {
        if (!cancelled) setCompletedModuleIds(rows.map((row) => row.module_id))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your training progress.')
      })
    return () => {
      cancelled = true
    }
  }, [profile.id])

  async function handleModuleComplete(moduleId: string) {
    try {
      await markModuleComplete(profile.id, moduleId)
    } catch {
      // The check already passed locally - a failed sync just means progress
      // won't be there next time they log in, which isn't worth blocking on.
    }
  }

  async function handleResetProgress() {
    try {
      await resetTrainingProgress(profile.id)
    } catch {
      // Best-effort - the local UI already resets regardless.
    }
  }

  return (
    <div style={{ paddingTop: 'var(--header-height)' }}>
      <PortalHeader portalLabel="Learner portal" userName={profile.full_name} onSignOut={signOut} />
      {loadError ? (
        <p className="message message-error" style={{ margin: 24 }}>
          {loadError}
        </p>
      ) : completedModuleIds === null ? (
        <p className="info-text" style={{ margin: 24 }}>
          Loading your training…
        </p>
      ) : (
        <TrainingPortal
          learnerName={profile.full_name}
          completedModuleIds={completedModuleIds}
          onModuleComplete={handleModuleComplete}
          onResetProgress={handleResetProgress}
          notesStorageKey={`buster-training-notes-${profile.id}`}
        />
      )}
    </div>
  )
}
