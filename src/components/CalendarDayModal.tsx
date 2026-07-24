import { useState } from 'react'
import { Modal } from './Modal'
import { addSaleEntry, deleteSaleEntry, updateSaleEntry } from '../data/queries'
import { calcEarnings, calcNet, sectionLabel } from '../lib/earnings'
import { formatCurrency } from '../lib/dates'
import type { Client, Profile, SaleEntry, SaleSection, SaleType } from '../types'

const sections: SaleSection[] = ['sexting', 'customs']

function EntryRow({
  entry,
  workerLabel,
  clients,
  saleTypes,
  onEntryUpdated,
  onEntryDeleted,
}: {
  entry: SaleEntry
  workerLabel: string
  clients: Client[]
  saleTypes: SaleType[]
  onEntryUpdated: (entry: SaleEntry) => void
  onEntryDeleted: (entryId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [clientId, setClientId] = useState(entry.client_id)
  const [section, setSection] = useState<SaleSection>(entry.section)
  const [buyerUsername, setBuyerUsername] = useState(entry.buyer_username)
  const [saleTypeId, setSaleTypeId] = useState(entry.sale_type_id)
  const [gross, setGross] = useState(String(entry.gross))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const grossValue = Number(gross)
  const hasValidGross = gross.trim() !== '' && Number.isFinite(grossValue) && grossValue >= 0

  function startEdit() {
    setClientId(entry.client_id)
    setSection(entry.section)
    setBuyerUsername(entry.buyer_username)
    setSaleTypeId(entry.sale_type_id)
    setGross(String(entry.gross))
    setError(null)
    setEditing(true)
  }

  async function handleSave() {
    setError(null)
    if (!buyerUsername.trim()) {
      setError('Enter a username.')
      return
    }
    if (!hasValidGross) {
      setError('Enter a valid gross amount.')
      return
    }
    setSaving(true)
    try {
      const updated = await updateSaleEntry(entry.id, {
        clientId,
        section,
        buyerUsername,
        saleTypeId,
        gross: grossValue,
      })
      onEntryUpdated(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this entry.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm('Delete this entry? This cannot be undone.')
    if (!confirmed) return
    try {
      await deleteSaleEntry(entry.id)
      onEntryDeleted(entry.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this entry.')
    }
  }

  if (editing) {
    const previewNet = hasValidGross ? calcNet(grossValue) : null
    const previewEarnings = previewNet !== null ? calcEarnings(previewNet, section) : null
    return (
      <tr>
        <td colSpan={8}>
          <div className="entry-add-row">
            <span>{workerLabel}</span>
            <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <select value={section} onChange={(event) => setSection(event.target.value as SaleSection)}>
              {sections.map((value) => (
                <option key={value} value={value}>
                  {sectionLabel[value]}
                </option>
              ))}
            </select>
            <input placeholder="Username" value={buyerUsername} onChange={(event) => setBuyerUsername(event.target.value)} />
            <select value={saleTypeId} onChange={(event) => setSaleTypeId(event.target.value)}>
              {saleTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="gross-input"
              min="0"
              step="0.01"
              placeholder="Gross"
              value={gross}
              onChange={(event) => setGross(event.target.value)}
            />
            <span className="entry-preview">
              {previewNet !== null && previewEarnings !== null
                ? `Net ${formatCurrency(previewNet)} · Earnings ${formatCurrency(previewEarnings)}`
                : ''}
            </span>
            <div className="roster-actions">
              <button type="button" className="btn-outline" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="link-btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
          {error && <p className="message message-error">{error}</p>}
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>{workerLabel}</td>
      <td>{clients.find((client) => client.id === entry.client_id)?.name ?? '—'}</td>
      <td>{sectionLabel[entry.section]}</td>
      <td>{entry.buyer_username}</td>
      <td>{saleTypes.find((type) => type.id === entry.sale_type_id)?.label ?? '—'}</td>
      <td>{formatCurrency(entry.gross)}</td>
      <td>{formatCurrency(entry.net)}</td>
      <td>{formatCurrency(entry.earnings)}</td>
      <td>
        <div className="roster-actions">
          <button type="button" className="link-btn" onClick={startEdit}>
            Amend
          </button>
          <button type="button" className="link-btn text-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
        {error && <p className="message message-error">{error}</p>}
      </td>
    </tr>
  )
}

function AddEntryRow({
  date,
  workers,
  clients,
  saleTypes,
  onEntryAdded,
}: {
  date: string
  workers: Profile[]
  clients: Client[]
  saleTypes: SaleType[]
  onEntryAdded: (entry: SaleEntry) => void
}) {
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? '')
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [section, setSection] = useState<SaleSection>('sexting')
  const [buyerUsername, setBuyerUsername] = useState('')
  const [saleTypeId, setSaleTypeId] = useState(saleTypes[0]?.id ?? '')
  const [gross, setGross] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const grossValue = Number(gross)
  const hasValidGross = gross.trim() !== '' && Number.isFinite(grossValue) && grossValue >= 0
  const previewNet = hasValidGross ? calcNet(grossValue) : null
  const previewEarnings = previewNet !== null ? calcEarnings(previewNet, section) : null

  async function handleAdd() {
    setError(null)
    if (!workerId) {
      setError('Choose a worker.')
      return
    }
    if (!clientId) {
      setError('Choose a client.')
      return
    }
    if (!buyerUsername.trim()) {
      setError('Enter a username.')
      return
    }
    if (!saleTypeId) {
      setError('Choose a type.')
      return
    }
    if (!hasValidGross) {
      setError('Enter a valid gross amount.')
      return
    }

    setSaving(true)
    try {
      const created = await addSaleEntry({
        workerId,
        entryDate: date,
        clientId,
        section,
        buyerUsername,
        saleTypeId,
        gross: grossValue,
      })
      onEntryAdded(created)
      setBuyerUsername('')
      setGross('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="entry-section">
      <h4>Add entry</h4>
      <div className="entry-add-row">
        <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
          {workers.length === 0 && <option value="">No workers</option>}
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.full_name}
            </option>
          ))}
        </select>
        <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
          {clients.length === 0 && <option value="">No clients</option>}
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <select value={section} onChange={(event) => setSection(event.target.value as SaleSection)}>
          {sections.map((value) => (
            <option key={value} value={value}>
              {sectionLabel[value]}
            </option>
          ))}
        </select>
        <input placeholder="Username" value={buyerUsername} onChange={(event) => setBuyerUsername(event.target.value)} />
        <select value={saleTypeId} onChange={(event) => setSaleTypeId(event.target.value)}>
          {saleTypes.length === 0 && <option value="">No types configured</option>}
          {saleTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="gross-input"
          min="0"
          step="0.01"
          placeholder="Gross"
          value={gross}
          onChange={(event) => setGross(event.target.value)}
        />
        <span className="entry-preview">
          {previewNet !== null && previewEarnings !== null
            ? `Net ${formatCurrency(previewNet)} · Earnings ${formatCurrency(previewEarnings)}`
            : ''}
        </span>
        <button
          type="button"
          className="btn-outline"
          onClick={handleAdd}
          disabled={saving || workers.length === 0 || clients.length === 0 || saleTypes.length === 0}
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <p className="message message-error">{error}</p>}
    </div>
  )
}

export function CalendarDayModal({
  date,
  workers,
  clients,
  saleTypes,
  entries,
  onEntryAdded,
  onEntryUpdated,
  onEntryDeleted,
  onClose,
}: {
  date: string
  workers: Profile[]
  clients: Client[]
  saleTypes: SaleType[]
  entries: SaleEntry[]
  onEntryAdded: (entry: SaleEntry) => void
  onEntryUpdated: (entry: SaleEntry) => void
  onEntryDeleted: (entryId: string) => void
  onClose: () => void
}) {
  const activeClients = clients.filter((client) => client.active)
  const activeSaleTypes = saleTypes.filter((type) => type.active)
  const dayTotal = entries.reduce((sum, entry) => sum + entry.earnings, 0)
  const workerLabel = (id: string) => workers.find((worker) => worker.id === id)?.full_name ?? 'Unknown worker'

  return (
    <Modal title={date} onClose={onClose}>
      <div className="detail-summary">
        <div>
          <p className="label">Day total</p>
          <strong>{formatCurrency(dayTotal)}</strong>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Client</th>
              <th>Section</th>
              <th>Buyer</th>
              <th>Type</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Earnings</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                workerLabel={workerLabel(entry.worker_id)}
                clients={clients}
                saleTypes={saleTypes}
                onEntryUpdated={onEntryUpdated}
                onEntryDeleted={onEntryDeleted}
              />
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No entries for this day.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeClients.length === 0 || workers.length === 0 ? (
        <p className="info-text">Add a worker and a client first to log entries here.</p>
      ) : (
        <AddEntryRow date={date} workers={workers} clients={activeClients} saleTypes={activeSaleTypes} onEntryAdded={onEntryAdded} />
      )}
    </Modal>
  )
}
