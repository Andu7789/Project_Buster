import { useState } from 'react'
import { formatCurrency, formatWeekRange, toISODate } from '../../lib/dates'
import { calcNet, calcOwnerSubmissionCut, ownerSubmissionCategoryLabel } from '../../lib/earnings'
import { SubmissionStatusBadge } from '../../components/StatusBadge'
import type { Client, ClientInvoice, OwnerSubmission, OwnerSubmissionCategory, OwnerSubmissionInvoice, OwnerSubmissionItem } from '../../types'

const categories: OwnerSubmissionCategory[] = ['subscriptions', 'tips', 'livestreams']

function OwnerSubmissionCategoryTable({
  category,
  client,
  items,
  entries,
  onAdd,
  onDelete,
}: {
  category: OwnerSubmissionCategory
  client: Client
  items: OwnerSubmissionItem[]
  entries: OwnerSubmission[]
  onAdd: (input: { category: OwnerSubmissionCategory; clientId: string; entryDate: string; itemId: string; gross: number }) => Promise<void>
  onDelete: (entryId: string) => Promise<void>
}) {
  const [entryDate, setEntryDate] = useState(() => toISODate(new Date()))
  const [itemId, setItemId] = useState(items[0]?.id ?? '')
  const [overridePrice, setOverridePrice] = useState(false)
  const [grossDraft, setGrossDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedItem = items.find((item) => item.id === itemId) ?? null
  const grossValue = overridePrice ? Number(grossDraft) : selectedItem?.price ?? 0
  const hasValidGross = overridePrice ? grossDraft.trim() !== '' && Number.isFinite(grossValue) && grossValue >= 0 : selectedItem !== null
  const previewNet = hasValidGross ? calcNet(grossValue) : null
  const previewOwnerCut = previewNet !== null ? calcOwnerSubmissionCut(previewNet) : null

  const subtotal = entries.reduce((sum, entry) => sum + entry.owner_cut, 0)

  async function handleAdd() {
    setError(null)
    if (!itemId) {
      setError('Choose an item.')
      return
    }
    if (!hasValidGross) {
      setError('Enter a valid gross amount.')
      return
    }

    setSaving(true)
    try {
      await onAdd({ category, clientId: client.id, entryDate, itemId, gross: grossValue })
      setGrossDraft('')
      setOverridePrice(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this entry.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entryId: string) {
    try {
      await onDelete(entryId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this entry.')
    }
  }

  return (
    <div className="entry-section">
      <h4>{ownerSubmissionCategoryLabel[category]}</h4>
      <div className="table-wrapper">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Item</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Owner cut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.entry_date}</td>
                <td>{items.find((item) => item.id === entry.item_id)?.label ?? '—'}</td>
                <td>{formatCurrency(entry.gross)}</td>
                <td>{formatCurrency(entry.net)}</td>
                <td>{formatCurrency(entry.owner_cut)}</td>
                <td>
                  <button type="button" className="link-btn" onClick={() => handleDelete(entry.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Subtotal</td>
              <td colSpan={2}>
                <strong>{formatCurrency(subtotal)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="owner-submission-add-row">
        <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
        <select
          value={itemId}
          onChange={(event) => {
            setItemId(event.target.value)
            setOverridePrice(false)
            setGrossDraft('')
          }}
        >
          {items.length === 0 && <option value="">No items configured</option>}
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} — {formatCurrency(item.price)}
            </option>
          ))}
        </select>
        <label className="owner-submission-override">
          <input
            type="checkbox"
            checked={overridePrice}
            onChange={(event) => {
              setOverridePrice(event.target.checked)
              setGrossDraft(event.target.checked ? String(selectedItem?.price ?? '') : '')
            }}
          />
          Override price
        </label>
        {overridePrice ? (
          <input
            type="number"
            className="gross-input"
            min="0"
            step="0.01"
            placeholder="Gross"
            value={grossDraft}
            onChange={(event) => setGrossDraft(event.target.value)}
          />
        ) : (
          <input type="text" className="gross-input" value={selectedItem ? formatCurrency(selectedItem.price) : ''} disabled />
        )}
        <span className="entry-preview">
          {previewNet !== null && previewOwnerCut !== null
            ? `Net ${formatCurrency(previewNet)} · Owner cut ${formatCurrency(previewOwnerCut)}`
            : ''}
        </span>
        <button type="button" className="btn-outline" onClick={handleAdd} disabled={saving || items.length === 0}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <p className="message message-error">{error}</p>}
    </div>
  )
}

export function OwnerSubmissionsTab({
  activeClients,
  ownerSubmissionItems,
  ownerSubmissions,
  ownerSubmissionInvoices,
  clientInvoices,
  currentWeekStart,
  currentWeekEnd,
  onAddOwnerSubmission,
  onDeleteOwnerSubmission,
  onOpenInvoice,
  missingWorkerNamesForClient,
}: {
  activeClients: Client[]
  ownerSubmissionItems: OwnerSubmissionItem[]
  ownerSubmissions: OwnerSubmission[]
  ownerSubmissionInvoices: OwnerSubmissionInvoice[]
  clientInvoices: ClientInvoice[]
  currentWeekStart: string
  currentWeekEnd: string
  onAddOwnerSubmission: (input: {
    category: OwnerSubmissionCategory
    clientId: string
    entryDate: string
    itemId: string
    gross: number
  }) => Promise<void>
  onDeleteOwnerSubmission: (entryId: string) => Promise<void>
  onOpenInvoice: (client: Client) => void
  missingWorkerNamesForClient: (clientId: string) => string[]
}) {
  const activeItemsByCategory = (category: OwnerSubmissionCategory) =>
    ownerSubmissionItems.filter((item) => item.category === category && item.active)

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Owner Submissions</h2>
          <p>{formatWeekRange(currentWeekStart, currentWeekEnd)} — log this week's Subscriptions, Tips and Livestreams per client.</p>
        </div>
      </div>

      {activeClients.length === 0 ? (
        <p className="info-text">No clients configured yet — add one from Teams, Clients & Sale Types.</p>
      ) : (
        activeClients.map((client, index) => {
          const clientEntries = ownerSubmissions.filter((entry) => entry.client_id === client.id)
          const ownerSubmissionsCut = clientEntries.reduce((sum, entry) => sum + entry.owner_cut, 0)
          const existingInvoice = ownerSubmissionInvoices.find(
            (invoice) => invoice.client_id === client.id && invoice.week_start === currentWeekStart,
          )
          const clientInvoiceOwnerCut =
            clientInvoices.find((invoice) => invoice.client_id === client.id && invoice.week_start === currentWeekStart)
              ?.owner_cut ?? 0
          const missingWorkerNames = missingWorkerNamesForClient(client.id)

          return (
            <div key={client.id} className={`entry-client entry-client-${index % 5}`}>
              <h3>{client.name}</h3>
              {categories.map((category) => (
                <OwnerSubmissionCategoryTable
                  key={category}
                  category={category}
                  client={client}
                  items={activeItemsByCategory(category)}
                  entries={clientEntries.filter((entry) => entry.category === category)}
                  onAdd={onAddOwnerSubmission}
                  onDelete={onDeleteOwnerSubmission}
                />
              ))}

              <div className="detail-summary">
                <div>
                  <p className="label">Owner submissions cut</p>
                  <strong>{formatCurrency(ownerSubmissionsCut)}</strong>
                </div>
                <div>
                  <p className="label">Client invoice owner cut</p>
                  <strong>{formatCurrency(clientInvoiceOwnerCut)}</strong>
                </div>
                <div>
                  <p className="label">Status</p>
                  <strong>
                    <SubmissionStatusBadge dealtWith={existingInvoice?.dealt_with ?? false} />
                  </strong>
                </div>
              </div>

              {!existingInvoice && missingWorkerNames.length > 0 && (
                <p className="message message-error">
                  Waiting on this week's timesheet from {missingWorkerNames.join(', ')}.
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-primary" onClick={() => onOpenInvoice(client)}>
                  {existingInvoice ? 'View weekly invoice' : 'Create weekly invoice'}
                </button>
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}
