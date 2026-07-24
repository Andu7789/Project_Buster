import { useEffect, useMemo, useState } from 'react'
import { listSaleEntriesForRange } from '../../data/queries'
import { daysOfWeek, formatCurrency, formatMonthLabel, getMonthGridDates, toISODate } from '../../lib/dates'
import type { Client, Profile, SaleEntry } from '../../types'
import { Modal } from '../../components/Modal'

export function CalendarTab({ workers, clients }: { workers: Profile[]; clients: Client[] }) {
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [entries, setEntries] = useState<SaleEntry[]>([])
  const [loadedRangeKey, setLoadedRangeKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const gridDates = useMemo(() => getMonthGridDates(monthCursor), [monthCursor])
  const rangeKey = `${gridDates[0]}_${gridDates[gridDates.length - 1]}`
  const loading = loadedRangeKey !== rangeKey
  const todayIso = useMemo(() => toISODate(new Date()), [])
  const currentMonthIndex = monthCursor.getMonth()

  useEffect(() => {
    let cancelled = false
    listSaleEntriesForRange(gridDates[0], gridDates[gridDates.length - 1])
      .then((data) => {
        if (cancelled) return
        setEntries(data)
        setLoadError(null)
        setLoadedRangeKey(rangeKey)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Could not load calendar entries.')
        setLoadedRangeKey(rangeKey)
      })
    return () => {
      cancelled = true
    }
  }, [gridDates, rangeKey])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, SaleEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.entry_date) ?? []
      list.push(entry)
      map.set(entry.entry_date, list)
    }
    return map
  }, [entries])

  const selectedDayEntries = selectedDay ? entriesByDate.get(selectedDay) ?? [] : []
  const workerName = (id: string) => workers.find((worker) => worker.id === id)?.full_name ?? 'Unknown worker'
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? 'Unknown client'

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Calendar</h2>
          <p>Daily sales across the whole team. Click a day for details.</p>
        </div>
        <div className="calendar-nav">
          <button
            type="button"
            className="btn-outline"
            onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          >
            ‹ Prev
          </button>
          <strong>{formatMonthLabel(monthCursor)}</strong>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          >
            Next ›
          </button>
          <button type="button" className="btn-outline" onClick={() => setMonthCursor(new Date())}>
            Today
          </button>
        </div>
      </div>

      {loading ? (
        <p className="info-text">Loading calendar…</p>
      ) : loadError ? (
        <p className="message message-error">{loadError}</p>
      ) : (
        <>
          <div className="calendar-weekday-row">
            {daysOfWeek.map((day) => (
              <span key={day}>{day.slice(0, 3)}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {gridDates.map((date) => {
              const dayEntries = entriesByDate.get(date) ?? []
              const total = dayEntries.reduce((sum, entry) => sum + entry.gross, 0)
              const inCurrentMonth = new Date(date).getMonth() === currentMonthIndex
              return (
                <button
                  key={date}
                  type="button"
                  className={`calendar-cell ${inCurrentMonth ? '' : 'calendar-cell-muted'} ${
                    date === todayIso ? 'calendar-cell-today' : ''
                  }`}
                  onClick={() => setSelectedDay(date)}
                >
                  <span className="calendar-cell-date">{Number(date.slice(-2))}</span>
                  {dayEntries.length > 0 && <span className="calendar-cell-total">{formatCurrency(total)}</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      {selectedDay && (
        <Modal title={selectedDay} onClose={() => setSelectedDay(null)}>
          <div className="table-wrapper">
            <table className="submission-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Client</th>
                  <th>Section</th>
                  <th>Buyer</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Earnings</th>
                </tr>
              </thead>
              <tbody>
                {selectedDayEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{workerName(entry.worker_id)}</td>
                    <td>{clientName(entry.client_id)}</td>
                    <td>{entry.section}</td>
                    <td>{entry.buyer_username}</td>
                    <td>{formatCurrency(entry.gross)}</td>
                    <td>{formatCurrency(entry.net)}</td>
                    <td>{formatCurrency(entry.earnings)}</td>
                  </tr>
                ))}
                {selectedDayEntries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      No entries for this day.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </section>
  )
}
