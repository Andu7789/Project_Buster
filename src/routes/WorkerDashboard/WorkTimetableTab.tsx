import { Fragment, useEffect, useState } from 'react'
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
                <th>Client</th>
                {daysOfWeek.map((day) => (
                  <th key={day}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <div>{clients.find((client) => client.id === row.client_id)?.name ?? 'Unknown client'}</div>
                      <div className="info-text timetable-week-label">{formatWeekRange(week1.weekStart, week1.weekEnd)}</div>
                    </td>
                    {week1.dates.map((date) => (
                      <td key={date}>{formatShiftLabel(shiftForDate(row.shifts, date))}</td>
                    ))}
                  </tr>
                  <tr className="timetable-week2-row">
                    <td>
                      <div className="info-text timetable-week-label">{formatWeekRange(week2.weekStart, week2.weekEnd)}</div>
                    </td>
                    {week2.dates.map((date) => (
                      <td key={date}>{formatShiftLabel(shiftForDate(row.shifts, date))}</td>
                    ))}
                  </tr>
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={daysOfWeek.length + 1} className="empty-row">
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
