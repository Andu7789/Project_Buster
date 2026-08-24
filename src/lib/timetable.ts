import type { DayShift } from '../types'

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
