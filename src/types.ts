export type UserRole = 'worker' | 'owner' | 'learner' | 'developer'

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

export interface TrainingProgress {
  id: string
  learner_id: string
  module_id: string
  completed_at: string
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

/** A contractor who logged work for a client this week but isn't fully accounted for yet. */
export interface PendingContractor {
  name: string
  status: 'not_submitted' | 'awaiting_confirmation'
}

export type PaymentMethodType = 'bank' | 'wise' | 'paypal'

export interface Client {
  id: string
  name: string
  real_name: string | null
  payment_method: PaymentMethodType | null
  next_invoice_number: number
  pm_sales_owner_percent: number
  sexting_owner_percent: number
  customs_owner_percent: number
  color: string
  active: boolean
  created_at: string
}

/** The owner's own payout details for a method (bank/WISE/PayPal) - a fixed set of 3 rows, owner-only. */
export interface PaymentMethod {
  id: string
  method: PaymentMethodType
  details: Record<string, string>
  updated_at: string
}

export interface SaleType {
  id: string
  label: string
  active: boolean
  created_at: string
}

export type SaleSection = 'sexting' | 'customs'

export interface SaleEntry {
  id: string
  worker_id: string
  entry_date: string
  client_id: string | null
  section: SaleSection
  buyer_username: string
  sale_type_id: string
  gross: number
  net: number
  earnings: number
  created_at: string
}

export interface CalendarEvent {
  id: string
  event_date: string
  title: string
  notes: string | null
  created_at: string
}

export interface ClientInvoice {
  id: string
  client_id: string
  week_start: string
  week_end: string
  sexting_net: number
  customs_net: number
  worker_cut: number
  owner_cut: number
  client_payout: number
  dealt_with: boolean
  created_at: string
}

export type OwnerSubmissionCategory = 'subscriptions' | 'tips' | 'livestreams' | 'paige_sexting' | 'alex_sexting'

export interface OwnerSubmission {
  id: string
  category: OwnerSubmissionCategory
  client_id: string | null
  entry_date: string
  buyer_username: string
  gross: number
  net: number
  owner_cut: number
  created_at: string
}

export interface OwnerSubmissionInvoice {
  id: string
  client_id: string
  week_start: string
  week_end: string
  subscriptions_owner_cut: number
  tips_owner_cut: number
  livestreams_owner_cut: number
  paige_sexting_owner_cut: number
  alex_sexting_owner_cut: number
  owner_submissions_cut: number
  client_invoice_owner_cut: number
  combined_owner_cut: number
  dealt_with: boolean
  created_at: string
}

export type RequestType = 'bug' | 'feature' | 'billing'
export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent'
export type RequestStatus = 'open' | 'in_progress' | 'needs_info' | 'completed' | 'declined'

export interface DevRequest {
  id: string
  created_by: string
  type: RequestType
  title: string
  description: string
  priority: RequestPriority
  status: RequestStatus
  progress: number
  screenshot_paths: string[]
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

export interface RequestComment {
  id: string
  request_id: string
  author_id: string
  body: string
  created_at: string
}
