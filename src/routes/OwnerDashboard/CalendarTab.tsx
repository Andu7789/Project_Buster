import { useEffect, useMemo, useState } from 'react'
import { listSaleEntriesForRange } from '../../data/queries'
import { daysOfWeek, formatCurrency, formatMonthLabel, getMonthGridDates, toISODate } from '../../lib/dates'
import type { Client, Profile, SaleEntry, SaleType } from '../../types'
import { CalendarDayModal } from '../../components/CalendarDayModal'

export function CalendarTab({ workers, clients, saleTypes }: { workers: Profile[]; clients: Client[]; saleTypes: SaleType[] }) {
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [entries, setEntries] = useState<SaleEntry[]>([])
  const [loadedRangeKey, setLoadedRangeKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

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

  const workerName = (id: string) => workers.find((worker) => worker.id === id)?.full_name ?? 'Unknown worker'
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? 'Unknown client'

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return entries
    return entries.filter((entry) => {
      return (
        entry.buyer_username.toLowerCase().includes(term) ||
        workerName(entry.worker_id).toLowerCase().includes(term) ||
        clientName(entry.client_id).toLowerCase().includes(term)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, searchTerm, workers, clients])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, SaleEntry[]>()
    for (const entry of filteredEntries) {
      const list = map.get(entry.entry_date) ?? []
      list.push(entry)
      map.set(entry.entry_date, list)
    }
    return map
  }, [filteredEntries])

  const selectedDayEntries = selectedDay ? entriesByDate.get(selectedDay) ?? [] : []
  const isSearching = searchTerm.trim() !== ''

  function handleEntryAdded(entry: SaleEntry) {
    setEntries((previous) => [...previous, entry])
  }

  function handleEntryUpdated(entry: SaleEntry) {
    setEntries((previous) => previous.map((existing) => (existing.id === entry.id ? entry : existing)))
  }

  function handleEntryDeleted(entryId: string) {
    setEntries((previous) => previous.filter((entry) => entry.id !== entryId))
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Calendar</h2>
          <p>Daily sales across the whole team. Click a day to add, amend, or delete entries.</p>
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

      <input
        type="search"
        className="calendar-search"
        placeholder="Search by worker, client, or username…"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        aria-label="Search calendar entries"
      />

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
              const muted = !inCurrentMonth || (isSearching && dayEntries.length === 0)
              return (
                <button
                  key={date}
                  type="button"
                  className={`calendar-cell ${muted ? 'calendar-cell-muted' : ''} ${
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
        <CalendarDayModal
          date={selectedDay}
          workers={workers}
          clients={clients}
          saleTypes={saleTypes}
          entries={selectedDayEntries}
          onEntryAdded={handleEntryAdded}
          onEntryUpdated={handleEntryUpdated}
          onEntryDeleted={handleEntryDeleted}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </section>
  )
}
