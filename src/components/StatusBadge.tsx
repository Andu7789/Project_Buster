import type { ReactNode } from 'react'
import type { ProfileStatus, RequestPriority, RequestStatus, RequestType } from '../types'

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
    <StatusBadge tone="success">Confirmed</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Pending</StatusBadge>
  )
}

export function PaidStatusBadge({ paid }: { paid: boolean }) {
  return paid ? <StatusBadge tone="success">Paid</StatusBadge> : <StatusBadge tone="warning">Unpaid</StatusBadge>
}

export function CustomerOrderStatusBadge({ complete }: { complete: boolean }) {
  return complete ? <StatusBadge tone="success">Complete</StatusBadge> : <StatusBadge tone="danger">Incomplete</StatusBadge>
}

const requestTypeLabels: Record<RequestType, string> = {
  bug: 'Bug',
  feature: 'Feature idea',
  billing: 'Charge request',
}

export function RequestTypeBadge({ type }: { type: RequestType }) {
  return <StatusBadge tone="neutral">{requestTypeLabels[type]}</StatusBadge>
}

const requestPriorityMeta: Record<RequestPriority, { tone: Tone; label: string }> = {
  low: { tone: 'neutral', label: 'Low priority' },
  medium: { tone: 'info', label: 'Medium priority' },
  high: { tone: 'warning', label: 'High priority' },
  urgent: { tone: 'danger', label: 'Urgent' },
}

export function RequestPriorityBadge({ priority }: { priority: RequestPriority }) {
  const meta = requestPriorityMeta[priority]
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}

const requestStatusMeta: Record<RequestStatus, { tone: Tone; label: string }> = {
  open: { tone: 'info', label: 'Open' },
  in_progress: { tone: 'warning', label: 'In progress' },
  needs_info: { tone: 'danger', label: 'Needs your input' },
  completed: { tone: 'success', label: 'Completed' },
  declined: { tone: 'neutral', label: 'Declined' },
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const meta = requestStatusMeta[status]
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}
