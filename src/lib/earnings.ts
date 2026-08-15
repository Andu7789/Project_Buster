import type { Client, OwnerSubmissionCategory, SaleEntry, SaleSection } from '../types'

export const NET_RATE = 0.8

export const EARNINGS_RATE: Record<SaleSection, number> = {
  sexting: 0.2,
  customs: 0.1,
}

export const sectionLabel: Record<SaleSection, string> = {
  sexting: 'Sexting',
  customs: 'Customs/Rates etc',
}

export function calcNet(gross: number): number {
  return gross * NET_RATE
}

export function calcEarnings(net: number, section: SaleSection): number {
  return net * EARNINGS_RATE[section]
}

/** Fallback owner-cut percentages for entries with no client (the "General" bucket) - every real client has its own explicit percentages. */
export const DEFAULT_SEXTING_OWNER_PERCENT = 20
export const DEFAULT_CUSTOMS_OWNER_PERCENT = 15
export const DEFAULT_PM_SALES_OWNER_PERCENT = 40

export function ownerCutPercentForSection(client: Client | undefined, section: SaleSection): number {
  if (!client) return section === 'sexting' ? DEFAULT_SEXTING_OWNER_PERCENT : DEFAULT_CUSTOMS_OWNER_PERCENT
  return section === 'sexting' ? client.sexting_owner_percent : client.customs_owner_percent
}

/** ownerCutPercent is a whole-number percent (e.g. 20 for 20%), per-client - see buster_clients.sexting_owner_percent/customs_owner_percent. */
export function calcOwnerCut(net: number, ownerCutPercent: number): number {
  return net * (ownerCutPercent / 100)
}

export function calcClientPayout(net: number, section: SaleSection, ownerCutPercent: number): number {
  return net - calcEarnings(net, section) - calcOwnerCut(net, ownerCutPercent)
}

export function clientPayoutTotal(entries: SaleEntry[], client: Client | undefined): number {
  const netBySection: Record<SaleSection, number> = { sexting: 0, customs: 0 }
  for (const entry of entries) netBySection[entry.section] += entry.net
  return (Object.keys(netBySection) as SaleSection[]).reduce(
    (sum, section) => sum + calcClientPayout(netBySection[section], section, ownerCutPercentForSection(client, section)),
    0,
  )
}

export const ownerSubmissionCategoryLabel: Record<OwnerSubmissionCategory, string> = {
  subscriptions: 'Purchases',
  tips: 'Tips',
  livestreams: 'Customs',
  paige_sexting: 'Paige sexting',
  alex_sexting: 'Alex sexting',
}

/**
 * subscriptions/tips/livestreams feed the "PPV Purchases & Tips" invoice
 * total; paige_sexting/alex_sexting feed "Sexting Sales & Customs" instead
 * (alongside contractor buster_sale_entries), since they're the same kind of
 * sale a contractor logs, just entered by the owner directly.
 */
export const PPV_OWNER_SUBMISSION_CATEGORIES: OwnerSubmissionCategory[] = ['subscriptions', 'tips', 'livestreams']
export const SEXTING_OWNER_SUBMISSION_CATEGORIES: OwnerSubmissionCategory[] = ['paige_sexting', 'alex_sexting']

/** defaultOwnerCutPercent and overridePercent are whole-number percents (e.g. 25 for 25%) - overridePercent, when given, replaces the client's default for this one entry. */
export function calcOwnerSubmissionCut(net: number, defaultOwnerCutPercent: number, overridePercent?: number): number {
  const percent = overridePercent !== undefined ? overridePercent : defaultOwnerCutPercent
  return net * (percent / 100)
}

/**
 * Orders client_id keys (plus 'general' for entries with no client) to match
 * `clients` - the same list/order a worker sees in the day-entry sheet's
 * client dropdown - so every client-grouped table in the app reads in the
 * same order as the sheet they filled in. Any key with no match in `clients`
 * (an unknown/removed client, or 'general') is appended after, in the order
 * it was first seen.
 */
function orderClientKeys(keys: Iterable<string>, clients: Client[]): string[] {
  const remaining = new Set(keys)
  const ordered: string[] = []
  for (const client of clients) {
    if (remaining.delete(client.id)) ordered.push(client.id)
  }
  ordered.push(...remaining)
  return ordered
}

function clientNameForKey(key: string, clients: Client[]): string {
  if (key === 'general') return 'General'
  return clients.find((c) => c.id === key)?.name ?? 'Unknown client'
}

export interface ClientEarningsTotal {
  clientName: string
  earnings: number
}

/** Groups a set of sale entries by client, summing each client's `earnings` (the worker's cut). */
export function earningsByClient(entries: SaleEntry[], clients: Client[]): ClientEarningsTotal[] {
  const totals = new Map<string, number>()
  for (const entry of entries) {
    const key = entry.client_id ?? 'general'
    totals.set(key, (totals.get(key) ?? 0) + entry.earnings)
  }
  return orderClientKeys(totals.keys(), clients).map((key) => ({
    clientName: clientNameForKey(key, clients),
    earnings: totals.get(key)!,
  }))
}

export interface ClientSectionBreakdownRow {
  clientName: string
  section: SaleSection
  gross: number
  net: number
  earnings: number
  ownerCut: number
}

const sectionOrder: SaleSection[] = ['sexting', 'customs']

/** Groups a set of sale entries by client + section (sexting/customs), summing gross/net/earnings/owner cut for each. */
export function breakdownByClientAndSection(entries: SaleEntry[], clients: Client[]): ClientSectionBreakdownRow[] {
  const rows = new Map<string, ClientSectionBreakdownRow>()
  const clientKeys = new Set<string>()
  for (const entry of entries) {
    const clientKey = entry.client_id ?? 'general'
    clientKeys.add(clientKey)
    const key = `${clientKey}:${entry.section}`
    const client = clients.find((c) => c.id === entry.client_id)
    const ownerCut = calcOwnerCut(entry.net, ownerCutPercentForSection(client, entry.section))
    const existing = rows.get(key)
    if (existing) {
      existing.gross += entry.gross
      existing.net += entry.net
      existing.earnings += entry.earnings
      existing.ownerCut += ownerCut
      continue
    }
    rows.set(key, {
      clientName: clientNameForKey(clientKey, clients),
      section: entry.section,
      gross: entry.gross,
      net: entry.net,
      earnings: entry.earnings,
      ownerCut,
    })
  }

  const ordered: ClientSectionBreakdownRow[] = []
  for (const clientKey of orderClientKeys(clientKeys, clients)) {
    for (const section of sectionOrder) {
      const row = rows.get(`${clientKey}:${section}`)
      if (row) ordered.push(row)
    }
  }
  return ordered
}

export interface ClientOwnerCutTotal {
  clientName: string
  sexting: number
  customs: number
  total: number
}

/** Groups a set of sale entries by client, summing the owner's cut per section (sexting/customs). */
export function ownerCutByClient(entries: SaleEntry[], clients: Client[]): ClientOwnerCutTotal[] {
  const totals = new Map<string, ClientOwnerCutTotal>()
  for (const entry of entries) {
    const key = entry.client_id ?? 'general'
    const client = clients.find((c) => c.id === entry.client_id)
    const cut = calcOwnerCut(entry.net, ownerCutPercentForSection(client, entry.section))
    const existing = totals.get(key)
    if (existing) {
      existing[entry.section] += cut
      existing.total += cut
      continue
    }
    const row: ClientOwnerCutTotal = {
      clientName: clientNameForKey(key, clients),
      sexting: 0,
      customs: 0,
      total: 0,
    }
    row[entry.section] += cut
    row.total += cut
    totals.set(key, row)
  }
  return orderClientKeys(totals.keys(), clients).map((key) => totals.get(key)!)
}
