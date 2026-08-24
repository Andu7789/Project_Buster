import { useEffect, useState, type FormEvent } from 'react'
import { addTimetableShift, deleteTimetableShift, listAllTimetableShifts, updateTimetableShift } from '../../data/queries'
import { daysOfWeek } from '../../lib/dates'
import type { Client, DayShift, Profile, TimetableShift } from '../../types'

/** Blank start and end (rather than a separate Off toggle) means the day is off. */
function DayCell({ value, onChange }: { value: DayShift | undefined; onChange: (value: DayShift | undefined) => void }) {
  function commit(start: string, end: string) {
    onChange(start || end ? { start, end } : undefined)
  }

  return (
    <div className="timetable-day-cell">
      <div className="timetable-time-inputs">
        <input type="time" value={value?.start ?? ''} onChange={(event) => commit(event.target.value, value?.end ?? '')} />
        <input type="time" value={value?.end ?? ''} onChange={(event) => commit(value?.start ?? '', event.target.value)} />
      </div>
    </div>
  )
}

function TimetableRow({
  row,
  workerName,
  clientName,
  onSave,
  onRemove,
}: {
  row: TimetableShift
  workerName: string
  clientName: string
  onSave: (rowId: string, shifts: Record<string, DayShift>) => Promise<void>
  onRemove: (rowId: string) => void
}) {
  const [draft, setDraft] = useState<Record<string, DayShift>>(row.shifts)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setDay(day: string, value: DayShift | undefined) {
    setDraft((previous) => {
      const next = { ...previous }
      if (value) next[day] = value
      else delete next[day]
      return next
    })
    setDirty(true)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await onSave(row.id, draft)
      setDirty(false)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this row.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr>
      <td>{workerName}</td>
      <td>{clientName}</td>
      {daysOfWeek.map((day) => (
        <td key={day}>
          <DayCell value={draft[day]} onChange={(value) => setDay(day, value)} />
        </td>
      ))}
      <td>
        <div className="roster-actions">
          <button type="button" className="btn-outline" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn-danger" onClick={() => onRemove(row.id)}>
            Remove
          </button>
        </div>
        {error && <p className="message message-error">{error}</p>}
        {saved && !error && <p className="message message-info">Saved.</p>}
      </td>
    </tr>
  )
}

export function WorkTimetableTab({ workers, clients }: { workers: Profile[]; clients: Client[] }) {
  const [rows, setRows] = useState<TimetableShift[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addWorkerId, setAddWorkerId] = useState('')
  const [addClientId, setAddClientId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const activeWorkers = workers.filter((worker) => worker.status === 'active')
  const activeClients = clients.filter((client) => client.active)

  useEffect(() => {
    let cancelled = false
    listAllTimetableShifts()
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load the timetable.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleAddRow(event: FormEvent) {
    event.preventDefault()
    if (!addWorkerId || !addClientId) return
    setAdding(true)
    setAddError(null)
    try {
      const created = await addTimetableShift({ clientId: addClientId, workerId: addWorkerId })
      setRows((previous) => [...previous, created])
      setAddWorkerId('')
      setAddClientId('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add this row - that contractor may already be on this client.')
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveRow(rowId: string, shifts: Record<string, DayShift>) {
    const updated = await updateTimetableShift(rowId, shifts)
    setRows((previous) => previous.map((row) => (row.id === rowId ? updated : row)))
  }

  async function handleRemoveRow(rowId: string) {
    const confirmed = window.confirm('Remove this row from the timetable?')
    if (!confirmed) return
    try {
      await deleteTimetableShift(rowId)
      setRows((previous) => previous.filter((row) => row.id !== rowId))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not remove this row.')
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    const clientCompare = (clients.find((c) => c.id === a.client_id)?.name ?? '').localeCompare(
      clients.find((c) => c.id === b.client_id)?.name ?? '',
    )
    if (clientCompare !== 0) return clientCompare
    return (workers.find((w) => w.id === a.worker_id)?.full_name ?? '').localeCompare(
      workers.find((w) => w.id === b.worker_id)?.full_name ?? '',
    )
  })

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Work timetable</h2>
          <p>Every contractor's weekly hours, across every client. A contractor can be added to more than one client.</p>
        </div>
      </div>

      <form className="add-worker-form" onSubmit={handleAddRow}>
        <label>
          Contractor
          <select value={addWorkerId} onChange={(event) => setAddWorkerId(event.target.value)}>
            <option value="">Select a contractor…</option>
            {activeWorkers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Client
          <select value={addClientId} onChange={(event) => setAddClientId(event.target.value)}>
            <option value="">Select a client…</option>
            {activeClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary" disabled={adding || !addWorkerId || !addClientId}>
          {adding ? 'Adding…' : 'Add row'}
        </button>
      </form>
      {addError && <p className="message message-error">{addError}</p>}

      {loading ? (
        <p className="info-text">Loading…</p>
      ) : (
        <div className="table-wrapper">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Client</th>
                {daysOfWeek.map((day) => (
                  <th key={day}>{day}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <TimetableRow
                  key={row.id}
                  row={row}
                  workerName={workers.find((worker) => worker.id === row.worker_id)?.full_name ?? 'Unknown'}
                  clientName={clients.find((client) => client.id === row.client_id)?.name ?? 'Unknown'}
                  onSave={handleSaveRow}
                  onRemove={handleRemoveRow}
                />
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={daysOfWeek.length + 3} className="empty-row">
                    No contractors added to the timetable yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {loadError && <p className="message message-error">{loadError}</p>}
    </section>
  )
}
