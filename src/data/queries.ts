import { supabase } from '../lib/supabase'
import type { Profile, ProfileStatus, Submission } from '../types'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  return supabase
}

/**
 * Looks up the profile already linked to this auth user. If none exists yet,
 * tries to claim a pending profile row that was pre-created (by an owner, or
 * by the one-time SQL seed) for this email address, via the buster_claim_profile()
 * RPC (a security-definer function - see supabase/schema.sql for why this
 * isn't a plain client-side update gated by an RLS policy).
 */
export async function findOrClaimProfile(userId: string): Promise<Profile | null> {
  const client = requireClient()

  const { data: existing, error: existingError } = await client
    .from('buster_profiles')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return existing as Profile

  const { data: claimed, error: claimError } = await client.rpc('buster_claim_profile')

  if (claimError) throw claimError
  return (claimed as Profile) ?? null
}

export async function listWorkers(): Promise<Profile[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_profiles')
    .select('*')
    .eq('role', 'worker')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Profile[]
}

/**
 * Adds a worker. If this email was previously added and then removed, this
 * restores that row instead of failing on the unique email constraint - if
 * they'd already signed up before being removed, they go straight back to
 * active (same login); otherwise they're reset to pending for a fresh signup.
 */
export async function addWorker(input: { fullName: string; email: string; ownerSharePercent: number }): Promise<Profile> {
  const client = requireClient()
  const email = input.email.trim().toLowerCase()

  const { data: existing, error: lookupError } = await client
    .from('buster_profiles')
    .select('*')
    .ilike('email', email)
    .maybeSingle()

  if (lookupError) throw lookupError

  if (existing) {
    if (existing.status !== 'removed') {
      throw new Error(`${existing.full_name} (${email}) is already on your team.`)
    }

    const { data, error } = await client
      .from('buster_profiles')
      .update({
        full_name: input.fullName,
        owner_share_percent: input.ownerSharePercent,
        status: existing.auth_user_id ? 'active' : 'pending',
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return data as Profile
  }

  const { data, error } = await client
    .from('buster_profiles')
    .insert({
      full_name: input.fullName,
      email,
      role: 'worker',
      owner_share_percent: input.ownerSharePercent,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Profile
}

export async function setWorkerStatus(profileId: string, status: ProfileStatus): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_profiles').update({ status }).eq('id', profileId)
  if (error) throw error
}

export async function updateWorkerShare(profileId: string, ownerSharePercent: number): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_profiles').update({ owner_share_percent: ownerSharePercent }).eq('id', profileId)
  if (error) throw error
}

export async function listSubmissionsForWorker(workerId: string): Promise<Submission[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_submissions')
    .select('*')
    .eq('worker_id', workerId)
    .order('week_start', { ascending: false })

  if (error) throw error
  return (data ?? []) as Submission[]
}

export async function listAllSubmissions(): Promise<Submission[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_submissions')
    .select('*')
    .order('week_start', { ascending: false })

  if (error) throw error
  return (data ?? []) as Submission[]
}

export async function submitTimesheet(input: {
  workerId: string
  weekStart: string
  weekEnd: string
  dayAmounts: Record<string, number>
  amount: number
  ownerSharePercent: number
  notes?: string
}): Promise<Submission> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_submissions')
    .insert({
      worker_id: input.workerId,
      week_start: input.weekStart,
      week_end: input.weekEnd,
      day_amounts: input.dayAmounts,
      amount: input.amount,
      owner_share_percent: input.ownerSharePercent,
      notes: input.notes || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Submission
}

export async function markDealtWith(submissionId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_submissions').update({ dealt_with: true }).eq('id', submissionId)
  if (error) throw error
}
