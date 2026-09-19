import { useEffect, useState, type FormEvent } from 'react'
import { addTimetableShift, deleteTimetableShift, listAllTimetableShifts, updateTimetableShift } from '../../data/queries'
import { daysOfWeek, formatWeekRange, getTimetableWeeks, type TimetableWeek } from '../../lib/dates'
import { clientColorVars } from '../../lib/clientColor'
import { formatShiftLabel, shiftForDate, SHIFT_PRESETS, shiftPresetKey } from '../../lib/timetable'
import type { Client, DayShift, Profile, TimetableShift } from '../../types'

/** No shift selected (rather than a separate Off toggle) means the day is off. Falls back to
 * showing a row's existing value as its own option if it predates the fixed preset blocks, so
 * saving the row again doesn't silently rewrite it to one of the four presets. */
function DayCell({ value, onChange }: { value: DayShift | undefined; onChange: (value: DayShift | undefined) => void }) {
  const currentKey = value ? shiftPresetKey(value) : ''
  const isKnownPreset = SHIFT_PRESETS.some((preset) => shiftPresetKey(preset) === currentKey)

  function handleChange(key: string) {
    if (!key) {
      onChange(undefined)
      return
    }
    const preset = SHIFT_PRESETS.find((preset) => shiftPresetKey(preset) === key)
    if (preset) onChange(preset)
  }

  return (
    <div className="timetable-day-cell">
      <select value={currentKey} onChange={(event) => handleChange(event.target.value)}>
        <option value="">Off</option>
        {SHIFT_PRESETS.map((preset) => (
          <option key={shiftPresetKey(preset)} value={shiftPresetKey(preset)}>
            {formatShiftLabel(preset)}
          </option>
        ))}
        {value && !isKnownPreset && <option value={currentKey}>{formatShiftLabel(value)}</option>}
      </select>
    </div>
  )
}

/** Seeds one draft entry per date across both weeks, keyed by the actual ISO date rather than
 * day name, so week 1 and week 2 can hold different shifts even on the same weekday. */
function buildDraft(shifts: TimetableShift['shifts'], week1: TimetableWeek, week2: TimetableWeek): Record<string, DayShift> {
  const draft: Record<string, DayShift> = {}
  for (const date of [...week1.dates, ...week2.dates]) {
    const value = shiftForDate(shifts, date)
    if (value) draft[date] = value
  }
  return draft
}

function TimetableRow({
  row,
  workerName,
  week1,
  week2,
  onSave,
  onRemove,
}: {
  row: TimetableShift
  workerName: string
  week1: TimetableWeek
  week2: TimetableWeek
  onSave: (rowId: string, shifts: Record<string, DayShift>) => Promise<void>
  onRemove: (rowId: string) => void
}) {
  const [draft, setDraft] = useState<Record<string, DayShift>>(() => buildDraft(row.shifts, week1, week2))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setDay(date: string, value: DayShift | undefined) {
    setDraft((previous) => {
      const next = { ...previous }
      if (value) next[date] = value
      else delete next[date]
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
    <>
      <tr>
        <td>
          <div>{workerName}</div>
          <div className="info-text timetable-week-label">{formatWeekRange(week1.weekStart, week1.weekEnd)}</div>
        </td>
        {week1.dates.map((date) => (
          <td key={date}>
            <DayCell value={draft[date]} onChange={(value) => setDay(date, value)} />
          </td>
        ))}
        <td rowSpan={2}>
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
      <tr className="timetable-week2-row">
        <td>
          <div className="info-text timetable-week-label">{formatWeekRange(week2.weekStart, week2.weekEnd)}</div>
        </td>
        {week2.dates.map((date) => (
          <td key={date}>
            <DayCell value={draft[date]} onChange={(value) => setDay(date, value)} />
          </td>
        ))}
      </tr>
    </>
  )
}

function ClientTimetableSection({
  client,
  activeWorkers,
  workers,
  rows,
  week1,
  week2,
  onAdd,
  onSaveRow,
  onRemoveRow,
}: {
  client: Client
  activeWorkers: Profile[]
  workers: Profile[]
  rows: TimetableShift[]
  week1: TimetableWeek
  week2: TimetableWeek
  onAdd: (clientId: string, workerId: string) => Promise<void>
  onSaveRow: (rowId: string, shifts: Record<string, DayShift>) => Promise<void>
  onRemoveRow: (rowId: string) => void
}) {
  const [addWorkerId, setAddWorkerId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const availableWorkers = activeWorkers.filter((worker) => !rows.some((row) => row.worker_id === worker.id))

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!addWorkerId) return
    setAdding(true)
    setAddError(null)
    try {
      await onAdd(client.id, addWorkerId)
      setAddWorkerId('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add this contractor.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="panel timetable-client-panel" style={clientColorVars(client.color)}>
      <div className="panel-head">
        <div>
          <h2>{client.name}</h2>
        </div>
      </div>

      <form className="add-worker-form" onSubmit={handleAdd}>
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
        <button type="submit" className="btn-primary btn-client-color" disabled={adding || !addWorkerId}>
          {adding ? 'Adding…' : 'Add contractor'}
        </button>
      </form>
      {addError && <p className="message message-error">{addError}</p>}

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
                week1={week1}
                week2={week2}
                onSave={onSaveRow}
                onRemove={onRemoveRow}
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
    </section>
  )
}

export function WorkTimetableTab({ workers, clients }: { workers: Profile[]; clients: Client[] }) {
  const [rows, setRows] = useState<TimetableShift[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const activeWorkers = workers.filter((worker) => worker.status === 'active')
  const activeClients = clients.filter((client) => client.active)
  const [week1, week2] = getTimetableWeeks()

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

  async function handleAdd(clientId: string, workerId: string) {
    const created = await addTimetableShift({ clientId, workerId })
    setRows((previous) => [...previous, created])
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

  if (loading) {
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Work timetable</h2>
          </div>
        </div>
        <p className="info-text">Loading…</p>
      </section>
    )
  }

  return (
    <>
      {activeClients.map((client) => (
        <ClientTimetableSection
          key={client.id}
          client={client}
          activeWorkers={activeWorkers}
          workers={workers}
          rows={rows.filter((row) => row.client_id === client.id)}
          week1={week1}
          week2={week2}
          onAdd={handleAdd}
          onSaveRow={handleSaveRow}
          onRemoveRow={handleRemoveRow}
        />
      ))}
      {activeClients.length === 0 && (
        <section className="panel">
          <p className="info-text">No active clients yet.</p>
        </section>
      )}
      {loadError && <p className="message message-error">{loadError}</p>}
    </>
  )
}
