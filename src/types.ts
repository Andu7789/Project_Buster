export type UserRole = 'worker' | 'owner'

export type ProfileStatus = 'pending' | 'active' | 'suspended' | 'removed'

export interface Profile {
  id: string
  auth_user_id: string | null
  email: string
  full_name: string
  role: UserRole
  owner_share_percent: number
  status: ProfileStatus
  created_at: string
}

export interface Submission {
  id: string
  worker_id: string
  week_start: string
  week_end: string
  day_amounts: Record<string, number>
  amount: number
  owner_share_percent: number
  dealt_with: boolean
  notes: string | null
  created_at: string
}
