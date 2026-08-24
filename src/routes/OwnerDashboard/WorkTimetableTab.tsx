import { useEffect, useState, type FormEvent } from 'react'
import {
  addTimetableShift,
  deleteTimetableShift,
  listTimetableShiftsForClient,
  updateTimetableShift,
} from '../../data/queries'
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
  onSave,
  onRemove,
}: {
  row: TimetableShift
  workerName: string
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
  const [selectedClientId, setSelectedClientId] = useState('')
  const [rows, setRows] = useState<TimetableShift[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addWorkerId, setAddWorkerId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const activeWorkers = workers.filter((worker) => worker.status === 'active')
  const activeClients = clients.filter((client) => client.active)

  useEffect(() => {
    if (!selectedClientId) return
    let cancelled = false
    listTimetableShiftsForClient(selectedClientId)
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
  }, [selectedClientId])

  async function handleAddWorker(event: FormEvent) {
    event.preventDefault()
    if (!addWorkerId) return
    setAdding(true)
    setAddError(null)
    try {
      const created = await addTimetableShift({ clientId: selectedClientId, workerId: addWorkerId })
      setRows((previous) => [...previous, created])
      setAddWorkerId('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add this contractor.')
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveRow(rowId: string, shifts: Record<string, DayShift>) {
    const updated = await updateTimetableShift(rowId, shifts)
    setRows((previous) => previous.map((row) => (row.id === rowId ? updated : row)))
  }

  async function handleRemoveRow(rowId: string) {
    const confirmed = window.confirm('Remove this contractor from the timetable?')
    if (!confirmed) return
    try {
      await deleteTimetableShift(rowId)
      setRows((previous) => previous.filter((row) => row.id !== rowId))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not remove this row.')
    }
  }

  const availableWorkers = activeWorkers.filter((worker) => !rows.some((row) => row.worker_id === worker.id))

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Work timetable</h2>
          <p>Pick a client, then add each contractor's weekly hours. A contractor can be added to more than one client.</p>
        </div>
      </div>

      <label>
        Client
        <select
          value={selectedClientId}
          onChange={(event) => {
            setSelectedClientId(event.target.value)
            setRows([])
            setLoading(Boolean(event.target.value))
            setLoadError(null)
          }}
        >
          <option value="">Select a client…</option>
          {activeClients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>

      {selectedClientId && (
        <>
          <form className="add-worker-form" onSubmit={handleAddWorker}>
            <label>
              Contractor
              <select value={addWorkerId} onChange={(event) => setAddWorkerId(event.target.value)}>
                <option value="">Select a contractor…</option>
                {availableWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.full_name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary" disabled={adding || !addWorkerId}>
              {adding ? 'Adding…' : 'Add contractor'}
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
                    {daysOfWeek.map((day) => (
                      <th key={day}>{day}</th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <TimetableRow
                      key={row.id}
                      row={row}
                      workerName={workers.find((worker) => worker.id === row.worker_id)?.full_name ?? 'Unknown'}
                      onSave={handleSaveRow}
                      onRemove={handleRemoveRow}
                    />
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={daysOfWeek.length + 2} className="empty-row">
                        No contractors added yet for this client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {loadError && <p className="message message-error">{loadError}</p>}
    </section>
  )
}
