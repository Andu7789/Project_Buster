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

/** Seeds one draft entry per date for just this one week, keyed by the actual ISO date rather
 * than day name, so week 1 and week 2 can hold different shifts even on the same weekday. */
function buildWeekDraft(shifts: TimetableShift['shifts'], week: TimetableWeek): Record<string, DayShift> {
  const draft: Record<string, DayShift> = {}
  for (const date of week.dates) {
    const value = shiftForDate(shifts, date)
    if (value) draft[date] = value
  }
  return draft
}

/** Folds one week's edited dates back into the row's full shifts record, leaving the other
 * week's dates (and any legacy day-name entries) untouched - each week block saves
 * independently, so this must never wholesale-replace the other week's already-saved data. */
function mergeWeekIntoShifts(
  shifts: TimetableShift['shifts'],
  week: TimetableWeek,
  weekDraft: Record<string, DayShift>,
): Record<string, DayShift> {
  const merged = { ...shifts }
  for (const date of week.dates) {
    if (weekDraft[date]) merged[date] = weekDraft[date]
    else delete merged[date]
  }
  return merged
}

function WeekRow({
  row,
  week,
  workerName,
  onSave,
  onRemove,
}: {
  row: TimetableShift
  week: TimetableWeek
  workerName: string
  onSave: (rowId: string, shifts: Record<string, DayShift>) => Promise<void>
  onRemove: (rowId: string) => void
}) {
  const [draft, setDraft] = useState<Record<string, DayShift>>(() => buildWeekDraft(row.shifts, week))
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
      await onSave(row.id, mergeWeekIntoShifts(row.shifts, week, draft))
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
      {week.dates.map((date) => (
        <td key={date}>
          <DayCell value={draft[date]} onChange={(value) => setDay(date, value)} />
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

function WeekBlock({
  week,
  rows,
  workers,
  onSaveRow,
  onRemoveRow,
}: {
  week: TimetableWeek
  rows: TimetableShift[]
  workers: Profile[]
  onSaveRow: (rowId: string, shifts: Record<string, DayShift>) => Promise<void>
  onRemoveRow: (rowId: string) => void
}) {
  return (
    <div className="timetable-week-block">
      <h3 className="detail-summary-heading">{formatWeekRange(week.weekStart, week.weekEnd)}</h3>
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
              <WeekRow
                key={row.id}
                row={row}
                week={week}
                workerName={workers.find((worker) => worker.id === row.worker_id)?.full_name ?? 'Unknown'}
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
    </div>
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

      <WeekBlock week={week1} rows={rows} workers={workers} onSaveRow={onSaveRow} onRemoveRow={onRemoveRow} />
      <WeekBlock week={week2} rows={rows} workers={workers} onSaveRow={onSaveRow} onRemoveRow={onRemoveRow} />
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
