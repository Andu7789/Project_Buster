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
  { description: 'GG Assistance – One Swap', amountGbp: 50 },
  { description: 'GG Assistance – Two Swaps', amountGbp: 75 },
  { description: 'GG Assistance – Three Swaps', amountGbp: 95 },
]

export const SFS_PRESETS: ServiceInvoicePreset[] = [
  { description: '1 SFS a day - 30 per month', amountGbp: 100 },
  { description: '2 SFS a day - 60 per month', amountGbp: 200 },
  { description: '3 SFS a day - 90 per month', amountGbp: 260 },
]

/** Priced individually per invoice - picking one of these clears the amount for manual entry. */
export const CUSTOM_SERVICE_DESCRIPTIONS: string[] = ['Scheduling assistance', 'Admin assistance']

/** Selecting this reveals free-text description + amount inputs instead of a preset. */
export const CUSTOM_SERVICE_OPTION = 'Other'

export function presetForDescription(description: string): ServiceInvoicePreset | undefined {
  return [...GG_SWAPS_PRESETS, ...SFS_PRESETS].find((preset) => preset.description === description)
}
