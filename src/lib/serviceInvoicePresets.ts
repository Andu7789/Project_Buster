/**
 * Fixed-price GG Swaps/SFS service options for the service invoice line-item dropdown - their
 * price auto-fills the line item's amount. "Scheduling assistance" and "Admin assistance" are
 * priced individually per client, so they're offered as free-amount options instead (see
 * CUSTOM_SERVICE_DESCRIPTIONS).
 */
export interface ServiceInvoicePreset {
  description: string
  amountGbp: number
}

export const GG_SWAPS_PRESETS: ServiceInvoicePreset[] = [
  { description: '1 Swap running at a time (weekly)', amountGbp: 50 },
  { description: '2 Swaps running at a time (weekly)', amountGbp: 75 },
  { description: '3 Swaps running at a time (weekly)', amountGbp: 95 },
]

export const SFS_PRESETS: ServiceInvoicePreset[] = [
  { description: '1 SFS a day - 30 per month', amountGbp: 100 },
  { description: '2 SFS a day - 60 per month', amountGbp: 200 },
  { description: '3 SFS a day - 90 per month', amountGbp: 260 },
]

/** Priced individually per invoice - picking one of these clears the amount for manual entry. */
export const CUSTOM_SERVICE_DESCRIPTIONS: string[] = ['Scheduling assistance', 'Admin assistance']

export const CUSTOM_SERVICE_OPTION = 'custom'

export function presetForDescription(description: string): ServiceInvoicePreset | undefined {
  return [...GG_SWAPS_PRESETS, ...SFS_PRESETS].find((preset) => preset.description === description)
}
