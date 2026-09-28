import { dayNameForDate } from './dates'
import type { DayShift, TimetableShift } from '../types'

/** "13:00" -> "1pm", "13:30" -> "1:30pm", "00:00" -> "12am". */
function formatClockTime(value: string): string {
  const [hourStr, minuteStr] = value.split(':')
  const hour24 = Number(hourStr)
  const minute = Number(minuteStr)
  const period = hour24 < 12 ? 'am' : 'pm'
  const hour12 = hour24 % 12 || 12
  return minute === 0 ? `${hour12}${period}` : `${hour12}:${String(minute).padStart(2, '0')}${period}`
}

/** No shift for the day means "Off" - see TimetableShift.shifts in types.ts. */
export function formatShiftLabel(shift: DayShift | undefined): string {
  if (!shift) return 'Off'
  return `${formatClockTime(shift.start)} – ${formatClockTime(shift.end)}`
}

/** The fixed blocks the owner picks a day's shift from, instead of typing arbitrary times. */
export const SHIFT_PRESETS: DayShift[] = [
  { start: '06:00', end: '12:00' },
  { start: '12:00', end: '17:00' },
  { start: '17:00', end: '00:00' },
  { start: '18:00', end: '00:00' },
  { start: '00:00', end: '06:00' },
]

export function shiftPresetKey(shift: DayShift): string {
  return `${shift.start}-${shift.end}`
}

/** A date's shift, falling back to the weekly default keyed by day name (e.g. "Monday") when
 * that date has never been set, so every new week starts pre-filled with the usual rota. A date
 * saved as null is an explicit day off and wins over the default. */
export function shiftForDate(shifts: TimetableShift['shifts'], isoDate: string): DayShift | undefined {
  if (isoDate in shifts) return shifts[isoDate] ?? undefined
  return shifts[dayNameForDate(isoDate)] ?? undefined
}

/** Replaces the row's weekly default with whatever this week's dates currently show, so the
 * owner can turn a finished week into the rota every later unset week falls back to. */
export function withWeekAsDefault(shifts: TimetableShift['shifts'], weekDates: string[]): TimetableShift['shifts'] {
  const next = { ...shifts }
  for (const date of weekDates) {
    const dayName = dayNameForDate(date)
    const value = shiftForDate(shifts, date)
    if (value) next[dayName] = value
    else delete next[dayName]
  }
  return next
}
