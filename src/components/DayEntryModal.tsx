import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { addSaleEntry, deleteSaleEntry } from '../data/queries'
import { calcEarnings, calcNet, sectionLabel } from '../lib/earnings'
import { formatCurrency } from '../lib/dates'
import { clientColorVars } from '../lib/clientColor'
import type { Client, SaleEntry, SaleSection, SaleType } from '../types'

const sections: SaleSection[] = ['sexting', 'customs']

// Contractors see friendlier wording on their own entry form; other views (invoices, dashboards) keep the "Sexting" label.
const entryFormSectionLabel: Record<SaleSection, string> = {
  ...sectionLabel,
  sexting: 'Purchases and Tips',
}

function ClientSection({
  client,
  section,
  workerId,
  date,
  entries,
  saleTypes,
  readOnly,
  onEntryAdded,
  onEntryDeleted,
}: {
  client: Client
  section: SaleSection
  workerId: string
  date: string
  entries: SaleEntry[]
  saleTypes: SaleType[]
  readOnly: boolean
  onEntryAdded: (entry: SaleEntry) => void
  onEntryDeleted: (entryId: string) => void
}) {
  const [buyerUsername, setBuyerUsername] = useState('')
  const [saleTypeId, setSaleTypeId] = useState(saleTypes[0]?.id ?? '')
  const [gross, setGross] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const grossValue = Number(gross)
  const hasValidGross = gross.trim() !== '' && Number.isFinite(grossValue) && grossValue >= 0
  const previewNet = hasValidGross ? calcNet(grossValue) : null
  const previewEarnings = previewNet !== null ? calcEarnings(previewNet, section) : null

  const subtotal = entries.reduce((sum, entry) => sum + entry.earnings, 0)

  async function handleAdd() {
    setError(null)
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
        clientId: client.id,
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

  async function handleDelete(entryId: string) {
    try {
      await deleteSaleEntry(entryId)
      onEntryDeleted(entryId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this entry.')
    }
  }

  return (
    <div className="entry-section">
      <h4>{entryFormSectionLabel[section]}</h4>
      <div className="table-wrapper">
        <table className="detail-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Type</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Earnings</th>
              {!readOnly && <th></th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.buyer_username}</td>
                <td>{saleTypes.find((type) => type.id === entry.sale_type_id)?.label ?? '—'}</td>
                <td>{formatCurrency(entry.gross)}</td>
                <td>{formatCurrency(entry.net)}</td>
                <td>{formatCurrency(entry.earnings)}</td>
                {!readOnly && (
                  <td>
                    <button type="button" className="link-btn" onClick={() => handleDelete(entry.id)}>
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 5 : 6} className="empty-row">
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Subtotal</td>
              <td colSpan={readOnly ? 1 : 2}>
                <strong>{formatCurrency(subtotal)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <div className="entry-add-row">
          <input
            placeholder="Username"
            value={buyerUsername}
            onChange={(event) => setBuyerUsername(event.target.value)}
          />
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
          <button type="button" className="btn-outline" onClick={handleAdd} disabled={saving || saleTypes.length === 0}>
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
      {error && <p className="message message-error">{error}</p>}
    </div>
  )
}

export function DayEntryModal({
  date,
  dayLabel,
  workerId,
  clients,
  saleTypes,
  entries,
  readOnly,
  onEntryAdded,
  onEntryDeleted,
  onClose,
}: {
  date: string
  dayLabel: string
  workerId: string
  clients: Client[]
  saleTypes: SaleType[]
  entries: SaleEntry[]
  readOnly: boolean
  onEntryAdded: (entry: SaleEntry) => void
  onEntryDeleted: (entryId: string) => void
  onClose: () => void
}) {
  const activeClients = useMemo(() => clients.filter((client) => client.active), [clients])
  const activeSaleTypes = useMemo(() => saleTypes.filter((type) => type.active), [saleTypes])
  const dayTotal = useMemo(() => entries.reduce((sum, entry) => sum + entry.earnings, 0), [entries])

  return (
    <Modal title={dayLabel} onClose={onClose}>
      <div className="detail-summary">
        <div>
          <p className="label">Day total</p>
          <strong>{formatCurrency(dayTotal)}</strong>
        </div>
      </div>

      {activeClients.length === 0 ? (
        <p className="info-text">No clients configured yet — ask your admin to add one.</p>
      ) : (
        activeClients.map((client) => (
          <div key={client.id} className="entry-client" style={clientColorVars(client.color)}>
            <h3>{client.name}</h3>
            {sections.map((section) => (
              <ClientSection
                key={section}
                client={client}
                section={section}
                workerId={workerId}
                date={date}
                entries={entries.filter((entry) => entry.client_id === client.id && entry.section === section)}
                saleTypes={activeSaleTypes}
                readOnly={readOnly}
                onEntryAdded={onEntryAdded}
                onEntryDeleted={onEntryDeleted}
              />
            ))}
          </div>
        ))
      )}
    </Modal>
  )
}
