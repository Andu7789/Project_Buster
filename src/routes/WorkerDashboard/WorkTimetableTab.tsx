import { useEffect, useState } from 'react'
import { listTimetableShiftsForWorker } from '../../data/queries'
import { daysOfWeek, formatWeekRange, getTimetableWeeks } from '../../lib/dates'
import { formatShiftLabel, shiftForDate } from '../../lib/timetable'
import type { Client, TimetableShift } from '../../types'

export function WorkTimetableTab({ workerId, clients }: { workerId: string; clients: Client[] }) {
  const [rows, setRows] = useState<TimetableShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [week1, week2] = getTimetableWeeks()

  useEffect(() => {
    let cancelled = false
    listTimetableShiftsForWorker(workerId)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your timetable.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workerId])

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Work timetable</h2>
          <p>Your hours for this week and next, set by the owner.</p>
        </div>
      </div>

      {loading ? (
        <p className="info-text">Loading…</p>
      ) : error ? (
        <p className="message message-error">{error}</p>
      ) : (
        <div className="table-wrapper">
          <table className="detail-table">
            <thead>
              <tr>
                <th rowSpan={2}>Client</th>
                <th colSpan={daysOfWeek.length}>{formatWeekRange(week1.weekStart, week1.weekEnd)}</th>
                <th colSpan={daysOfWeek.length} className="timetable-week-boundary">
                  {formatWeekRange(week2.weekStart, week2.weekEnd)}
                </th>
              </tr>
              <tr>
                {daysOfWeek.map((day) => (
                  <th key={`w1-${day}`}>{day}</th>
                ))}
                {daysOfWeek.map((day, index) => (
                  <th key={`w2-${day}`} className={index === 0 ? 'timetable-week-boundary' : undefined}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{clients.find((client) => client.id === row.client_id)?.name ?? 'Unknown client'}</td>
                  {week1.dates.map((date) => (
                    <td key={date}>{formatShiftLabel(shiftForDate(row.shifts, date))}</td>
                  ))}
                  {week2.dates.map((date, index) => (
                    <td key={date} className={index === 0 ? 'timetable-week-boundary' : undefined}>
                      {formatShiftLabel(shiftForDate(row.shifts, date))}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={daysOfWeek.length * 2 + 1} className="empty-row">
                    No timetable set yet - ask the owner to add your hours.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
