import type { SaleSection } from '../types'

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
