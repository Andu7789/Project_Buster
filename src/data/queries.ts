import { supabase } from '../lib/supabase'
import { calcEarnings, calcNet } from '../lib/earnings'
import type {
  CalendarEvent,
  Client,
  ClientInvoice,
  DevRequest,
  Profile,
  ProfileStatus,
  RequestComment,
  RequestPriority,
  RequestStatus,
  RequestType,
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

/** Developer-side name lookup for "raised by" - RLS scopes this to role='owner' rows only. */
export async function listOwners(): Promise<Profile[]> {
  const client = requireClient()
  const { data, error } = await client.from('buster_profiles').select('*').eq('role', 'owner')
  if (error) throw error
  return (data ?? []) as Profile[]
}

/** Owner-side name lookup for comment authorship - owners can already read every profile. */
export async function listDevelopers(): Promise<Profile[]> {
  const client = requireClient()
  const { data, error } = await client.from('buster_profiles').select('*').eq('role', 'developer')
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
  clientId: string | null
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

export async function updateSaleEntry(
  entryId: string,
  input: {
    clientId: string | null
    section: SaleSection
    buyerUsername: string
    saleTypeId: string
    gross: number
  },
): Promise<SaleEntry> {
  const client = requireClient()
  const net = calcNet(input.gross)
  const earnings = calcEarnings(net, input.section)

  const { data, error } = await client
    .from('buster_sale_entries')
    .update({
      client_id: input.clientId,
      section: input.section,
      buyer_username: input.buyerUsername.trim(),
      sale_type_id: input.saleTypeId,
      gross: input.gross,
      net,
      earnings,
    })
    .eq('id', entryId)
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

export async function listSaleEntriesForRange(startDate: string, endDate: string): Promise<SaleEntry[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_sale_entries')
    .select('*')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as SaleEntry[]
}

/** Alias kept for existing week-scoped call sites. */
export const listSaleEntriesForWeek = listSaleEntriesForRange

export async function listCalendarEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_calendar_events')
    .select('*')
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as CalendarEvent[]
}

export async function addCalendarEvent(input: { eventDate: string; title: string; notes?: string }): Promise<CalendarEvent> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_calendar_events')
    .insert({
      event_date: input.eventDate,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as CalendarEvent
}

export async function updateCalendarEvent(eventId: string, input: { title: string; notes?: string }): Promise<CalendarEvent> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_calendar_events')
    .update({
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
    })
    .eq('id', eventId)
    .select('*')
    .single()

  if (error) throw error
  return data as CalendarEvent
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('buster_calendar_events').delete().eq('id', eventId)
  if (error) throw error
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

/** Owner-side: only the requests this profile raised. */
export async function listRequestsForOwner(ownerId: string): Promise<DevRequest[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_requests')
    .select('*')
    .eq('created_by', ownerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as DevRequest[]
}

/** Developer-side: every request - RLS already restricts this to developers. */
export async function listAllRequests(): Promise<DevRequest[]> {
  const client = requireClient()
  const { data, error } = await client.from('buster_requests').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DevRequest[]
}

export async function createRequest(input: {
  createdBy: string
  type: RequestType
  title: string
  description: string
  priority: RequestPriority
  screenshotPaths: string[]
}): Promise<DevRequest> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_requests')
    .insert({
      created_by: input.createdBy,
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      screenshot_paths: input.screenshotPaths,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as DevRequest
}

/** Developer-only (RLS-enforced): update the workflow fields of a request. */
export async function updateRequest(
  requestId: string,
  input: { status: RequestStatus; progress: number; resolutionNotes?: string | null },
): Promise<DevRequest> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_requests')
    .update({
      status: input.status,
      progress: input.progress,
      resolution_notes: input.resolutionNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single()

  if (error) throw error
  return data as DevRequest
}

/** Every comment the caller can see - RLS restricts this to their own requests' threads (owner) or all (developer). */
export async function listAllRequestComments(): Promise<RequestComment[]> {
  const client = requireClient()
  const { data, error } = await client.from('buster_request_comments').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as RequestComment[]
}

export async function addRequestComment(input: { requestId: string; authorId: string; body: string }): Promise<RequestComment> {
  const client = requireClient()
  const { data, error } = await client
    .from('buster_request_comments')
    .insert({ request_id: input.requestId, author_id: input.authorId, body: input.body.trim() })
    .select('*')
    .single()

  if (error) throw error
  return data as RequestComment
}

/** Uploads screenshots to the private request-screenshots bucket, one object per file under "<profileId>/...". */
export async function uploadRequestScreenshots(profileId: string, files: File[]): Promise<string[]> {
  const client = requireClient()
  const paths: string[] = []
  for (const file of files) {
    const path = `${profileId}/${crypto.randomUUID()}-${file.name}`
    const { error } = await client.storage.from('request-screenshots').upload(path, file)
    if (error) throw error
    paths.push(path)
  }
  return paths
}

/** Resolves storage paths to temporary signed URLs (the bucket is private). */
export async function getScreenshotSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const client = requireClient()
  const { data, error } = await client.storage.from('request-screenshots').createSignedUrls(paths, 3600)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl
  }
  return map
}

/**
 * Best-effort Telegram notification via the notify-telegram edge function -
 * failures are logged, not thrown, so a Telegram/edge-function hiccup never
 * blocks the request/comment/status-update it's reporting on.
 */
export async function notifyTelegram(
  event: 'request_created' | 'status_changed' | 'comment_added',
  payload: Record<string, unknown>,
): Promise<void> {
  const client = requireClient()
  try {
    const { error } = await client.functions.invoke('notify-telegram', { body: { event, ...payload } })
    if (error) console.error('Telegram notification failed:', error)
  } catch (err) {
    console.error('Telegram notification failed:', err)
  }
}
