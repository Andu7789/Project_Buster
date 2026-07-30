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

export const OWNER_RATE: Record<SaleSection, number> = {
  sexting: 0.2,
  customs: 0.15,
}

export function calcOwnerCut(net: number, section: SaleSection): number {
  return net * OWNER_RATE[section]
}

export function calcClientPayout(net: number, section: SaleSection): number {
  return net - calcEarnings(net, section) - calcOwnerCut(net, section)
}

export function clientPayoutTotal(entries: SaleEntry[]): number {
  const netBySection: Record<SaleSection, number> = { sexting: 0, customs: 0 }
  for (const entry of entries) netBySection[entry.section] += entry.net
  return (Object.keys(netBySection) as SaleSection[]).reduce(
    (sum, section) => sum + calcClientPayout(netBySection[section], section),
    0,
  )
}

export const ownerSubmissionCategoryLabel: Record<OwnerSubmissionCategory, string> = {
  subscriptions: 'Subscriptions',
  tips: 'Tips',
  livestreams: 'Livestreams',
}

export const OWNER_SUBMISSION_OWNER_RATE = 0.4

export function calcOwnerSubmissionCut(net: number): number {
  return net * OWNER_SUBMISSION_OWNER_RATE
}

export interface ClientEarningsTotal {
  clientName: string
  earnings: number
}

/** Groups a set of sale entries by client, summing each client's `earnings` (the worker's cut). */
export function earningsByClient(entries: SaleEntry[], clients: Client[]): ClientEarningsTotal[] {
  const totals = new Map<string, ClientEarningsTotal>()
  for (const entry of entries) {
    const key = entry.client_id ?? 'general'
    const existing = totals.get(key)
    if (existing) {
      existing.earnings += entry.earnings
      continue
    }
    totals.set(key, {
      clientName: entry.client_id ? clients.find((c) => c.id === entry.client_id)?.name ?? 'Unknown client' : 'General',
      earnings: entry.earnings,
    })
  }
  return Array.from(totals.values()).sort((a, b) => b.earnings - a.earnings)
}
