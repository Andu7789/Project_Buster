import { supabase } from '../lib/supabase'
import { calcEarnings, calcNet } from '../lib/earnings'
import type {
  Client,
  ClientInvoice,
  Profile,
  ProfileStatus,
  SaleEntry,
  SaleSection,
  SaleType,
  Submission,
  TrainingProgress,
} from '../types'

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

  const { data: claimed, error: claimError } = await client.rpc('buster_claim_profile').maybeSingle()

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

export async function listLearners(): Promise<Profile[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_profiles')
    .select('*')
    .eq('role', 'learner')
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

/**
 * Adds a learner. Mirrors addWorker() - restores a previously removed row by
 * email instead of failing on the unique constraint.
 */
export async function addLearner(input: { fullName: string; email: string }): Promise<Profile> {
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
      throw new Error(`${existing.full_name} (${email}) already has an account.`)
    }

    const { data, error } = await client
      .from('buster_profiles')
      .update({
        full_name: input.fullName,
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
      role: 'learner',
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Profile
}

export async function setProfileStatus(profileId: string, status: ProfileStatus): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_profiles').update({ status }).eq('id', profileId)
  if (error) throw error
}

/**
 * Permanently deletes an already-removed profile (and its dependent rows)
 * via the buster_delete_profile() RPC - see supabase/schema.sql for why this
 * can't be a plain client-side delete under RLS. Distinct from
 * setProfileStatus(id, 'removed'), which is the reversible, history-keeping
 * default.
 */
export async function deleteProfile(profileId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('buster_delete_profile', { target_id: profileId })
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

export async function listClients(): Promise<Client[]> {
  const client = requireClient()
  const { data, error } = await client.from('buster_clients').select('*').order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Client[]
}

export async function addClient(name: string): Promise<Client> {
  const client = requireClient()
  const { data, error } = await client.from('buster_clients').insert({ name: name.trim() }).select('*').single()
  if (error) throw error
  return data as Client
}

export async function setClientActive(clientId: string, active: boolean): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_clients').update({ active }).eq('id', clientId)
  if (error) throw error
}

export async function listSaleTypes(): Promise<SaleType[]> {
  const client = requireClient()
  const { data, error } = await client.from('buster_sale_types').select('*').order('label', { ascending: true })
  if (error) throw error
  return (data ?? []) as SaleType[]
}

export async function addSaleType(label: string): Promise<SaleType> {
  const client = requireClient()
  const { data, error } = await client.from('buster_sale_types').insert({ label: label.trim() }).select('*').single()
  if (error) throw error
  return data as SaleType
}

export async function setSaleTypeActive(saleTypeId: string, active: boolean): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_sale_types').update({ active }).eq('id', saleTypeId)
  if (error) throw error
}

export async function listSaleEntriesForWorker(workerId: string, weekStart: string, weekEnd: string): Promise<SaleEntry[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_sale_entries')
    .select('*')
    .eq('worker_id', workerId)
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as SaleEntry[]
}

export async function addSaleEntry(input: {
  workerId: string
  entryDate: string
  clientId: string
  section: SaleSection
  buyerUsername: string
  saleTypeId: string
  gross: number
}): Promise<SaleEntry> {
  const client = requireClient()
  const net = calcNet(input.gross)
  const earnings = calcEarnings(net, input.section)

  const { data, error } = await client
    .from('buster_sale_entries')
    .insert({
      worker_id: input.workerId,
      entry_date: input.entryDate,
      client_id: input.clientId,
      section: input.section,
      buyer_username: input.buyerUsername.trim(),
      sale_type_id: input.saleTypeId,
      gross: input.gross,
      net,
      earnings,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as SaleEntry
}

export async function deleteSaleEntry(entryId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_sale_entries').delete().eq('id', entryId)
  if (error) throw error
}

export async function listSaleEntriesForWeek(weekStart: string, weekEnd: string): Promise<SaleEntry[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_sale_entries')
    .select('*')
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as SaleEntry[]
}

export async function listClientInvoices(): Promise<ClientInvoice[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_client_invoices')
    .select('*')
    .order('week_start', { ascending: false })

  if (error) throw error
  return (data ?? []) as ClientInvoice[]
}

export async function createClientInvoice(input: {
  clientId: string
  weekStart: string
  weekEnd: string
  sextingNet: number
  customsNet: number
  workerCut: number
  ownerCut: number
  clientPayout: number
}): Promise<ClientInvoice> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_client_invoices')
    .insert({
      client_id: input.clientId,
      week_start: input.weekStart,
      week_end: input.weekEnd,
      sexting_net: input.sextingNet,
      customs_net: input.customsNet,
      worker_cut: input.workerCut,
      owner_cut: input.ownerCut,
      client_payout: input.clientPayout,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as ClientInvoice
}

export async function markClientInvoiceDealtWith(invoiceId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_client_invoices').update({ dealt_with: true }).eq('id', invoiceId)
  if (error) throw error
}

export async function listTrainingProgress(learnerId: string): Promise<TrainingProgress[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_training_progress')
    .select('*')
    .eq('learner_id', learnerId)

  if (error) throw error
  return (data ?? []) as TrainingProgress[]
}

/** Owner-side reporting: every learner's progress rows in one query. */
export async function listAllTrainingProgress(): Promise<TrainingProgress[]> {
  const client = requireClient()
  const { data, error } = await client.from('buster_training_progress').select('*')
  if (error) throw error
  return (data ?? []) as TrainingProgress[]
}

export async function markModuleComplete(learnerId: string, moduleId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client
    .from('buster_training_progress')
    .upsert({ learner_id: learnerId, module_id: moduleId }, { onConflict: 'learner_id,module_id' })
  if (error) throw error
}

export async function resetTrainingProgress(learnerId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_training_progress').delete().eq('learner_id', learnerId)
  if (error) throw error
}
