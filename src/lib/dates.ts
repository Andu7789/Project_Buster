export const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Returns the ISO date string for each day of `daysOfWeek`, starting from `weekStart` (a Monday). */
export function getWeekDates(weekStart: string): string[] {
  const monday = new Date(weekStart)
  return daysOfWeek.map((_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return toISODate(date)
  })
}

export function formatDayLabel(day: string, isoDate: string): string {
  const date = new Date(isoDate)
  return `${day}, ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

export function toISODate(date: Date): string {
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
  return `$${amount.toFixed(2)}`
}

/**
 * Returns the Monday-first calendar grid (as ISO date strings) covering `reference`'s month,
 * padded with leading/trailing days from adjacent months so every row is a full week.
 */
export function getMonthGridDates(reference: Date): string[] {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - firstWeekday)

  const lastOfMonth = new Date(year, month + 1, 0)
  const lastWeekday = (lastOfMonth.getDay() + 6) % 7
  const totalDays = firstWeekday + lastOfMonth.getDate() + (6 - lastWeekday)
  const weeks = Math.ceil(totalDays / 7)

  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return toISODate(date)
  })
}

export function formatMonthLabel(reference: Date): string {
  return reference.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
