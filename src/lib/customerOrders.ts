import type { CustomerOrder, CustomOrderType } from '../types'

export const customOrderTypes: CustomOrderType[] = ['custom_vid', 'custom_pics', 'video_cock_rate', 'panties_other']

export const customOrderTypeLabel: Record<CustomOrderType, string> = {
  custom_vid: 'Custom vid',
  custom_pics: 'Custom pics',
  video_cock_rate: 'Video cock rate',
  panties_other: 'Panties & other',
}

/** Field labels still missing from a customer order - empty array means the form is complete. */
export function missingCustomerOrderFields(order: CustomerOrder | undefined): string[] {
  const missing: string[] = []

  if (!order?.custom_type) {
    missing.push('Type of custom')
  } else if (order.custom_type === 'panties_other' && !order.custom_type_other?.trim()) {
    missing.push('Type of custom (specify)')
  }

  if (!order?.profile_link?.trim()) missing.push("Link to user's profile")
  if (!order?.custom_info?.trim()) missing.push('Information on the custom')
  if (order?.pinned_messages == null) missing.push('Pinned the relevant messages?')
  if (order?.added_to_waiting_list == null) missing.push("Added to the 'waiting for content' list?")

  return missing
}

export function isCustomerOrderComplete(order: CustomerOrder | undefined): boolean {
  return missingCustomerOrderFields(order).length === 0
}
