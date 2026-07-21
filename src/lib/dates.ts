export const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Returns the Monday-Sunday range (as ISO date strings) containing `reference` (defaults to today). */
export function getCurrentWeekRange(reference: Date = new Date()): { weekStart: string; weekEnd: string } {
  const date = new Date(reference)
  const dayIndex = (date.getDay() + 6) % 7 // 0 = Monday ... 6 = Sunday
  const monday = new Date(date)
  monday.setDate(date.getDate() - dayIndex)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { weekStart: toISODate(monday), weekEnd: toISODate(sunday) }
}

export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart)
  const end = new Date(weekEnd)
  const startLabel = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const endLabel = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

export function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`
}
