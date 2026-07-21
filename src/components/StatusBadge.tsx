import type { ReactNode } from 'react'
import type { ProfileStatus } from '../types'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

const profileStatusMeta: Record<ProfileStatus, { tone: Tone; label: string }> = {
  pending: { tone: 'warning', label: 'Invite pending' },
  active: { tone: 'success', label: 'Active' },
  suspended: { tone: 'danger', label: 'Suspended' },
  removed: { tone: 'neutral', label: 'Removed' },
}

export function ProfileStatusBadge({ status }: { status: ProfileStatus }) {
  const meta = profileStatusMeta[status]
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}

export function SubmissionStatusBadge({ dealtWith }: { dealtWith: boolean }) {
  return dealtWith ? (
    <StatusBadge tone="success">Invoiced</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Pending</StatusBadge>
  )
}
