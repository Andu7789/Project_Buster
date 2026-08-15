import { useState } from 'react'
import { formatCurrency, formatWeekRange, toISODate } from '../../lib/dates'
import {
  calcNet,
  calcOwnerSubmissionCut,
  ownerSubmissionCategoryLabel,
  PPV_OWNER_SUBMISSION_CATEGORIES,
  SEXTING_OWNER_SUBMISSION_CATEGORIES,
} from '../../lib/earnings'
import { clientColorVars } from '../../lib/clientColor'
import { SubmissionStatusBadge } from '../../components/StatusBadge'
import type { Client, ClientInvoice, OwnerSubmission, OwnerSubmissionCategory, OwnerSubmissionInvoice, PendingContractor } from '../../types'

function pendingContractorLabel(contractor: PendingContractor): string {
  return contractor.status === 'not_submitted'
    ? `${contractor.name} (not submitted)`
    : `${contractor.name} (awaiting confirmation)`
}

const categories: OwnerSubmissionCategory[] = ['subscriptions', 'tips', 'livestreams', 'paige_sexting', 'alex_sexting']

function OwnerSubmissionCategoryTable({
  category,
  client,
  entries,
  onAdd,
  onDelete,
}: {
  category: OwnerSubmissionCategory
  client: Client
  entries: OwnerSubmission[]
  onAdd: (input: {
    category: OwnerSubmissionCategory
    clientId: string
    entryDate: string
    buyerUsername: string
    gross: number
    defaultOwnerCutPercent: number
    ownerCutPercent?: number
  }) => Promise<void>
  onDelete: (entryId: string) => Promise<void>
}) {
  const defaultPercentDraft = String(client.pm_sales_owner_percent)
  const [entryDate, setEntryDate] = useState(() => toISODate(new Date()))
  const [buyerUsername, setBuyerUsername] = useState('')
  const [grossDraft, setGrossDraft] = useState('')
  const [overridePercent, setOverridePercent] = useState(false)
  const [percentDraft, setPercentDraft] = useState(defaultPercentDraft)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const grossValue = Number(grossDraft)
  const hasValidGross = grossDraft.trim() !== '' && Number.isFinite(grossValue) && grossValue >= 0
  const percentValue = Number(percentDraft)
  const hasValidPercent = !overridePercent || (percentDraft.trim() !== '' && Number.isFinite(percentValue) && percentValue >= 0)
  const previewNet = hasValidGross ? calcNet(grossValue) : null
  const previewOwnerCut =
    previewNet !== null && hasValidPercent
      ? calcOwnerSubmissionCut(previewNet, client.pm_sales_owner_percent, overridePercent ? percentValue : undefined)
      : null

  const subtotal = entries.reduce((sum, entry) => sum + entry.owner_cut, 0)

  async function handleAdd() {
    setError(null)
    if (!buyerUsername.trim()) {
      setError('Enter a username.')
      return
    }
    if (!hasValidGross) {
      setError('Enter a valid amount.')
      return
    }
    if (!hasValidPercent) {
      setError('Enter a valid override %.')
      return
    }

    setSaving(true)
    try {
      await onAdd({
        category,
        clientId: client.id,
        entryDate,
        buyerUsername,
        gross: grossValue,
        defaultOwnerCutPercent: client.pm_sales_owner_percent,
        ownerCutPercent: overridePercent ? percentValue : undefined,
      })
      setBuyerUsername('')
      setGrossDraft('')
      setOverridePercent(false)
      setPercentDraft(defaultPercentDraft)
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
              <th>Username</th>
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
                <td>{entry.buyer_username}</td>
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

      <form
        className="owner-submission-add-row"
        onSubmit={(event) => {
          event.preventDefault()
          handleAdd()
        }}
      >
        <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
        <input
          type="text"
          className="gross-input"
          placeholder="Username"
          value={buyerUsername}
          onChange={(event) => setBuyerUsername(event.target.value)}
        />
        <input
          type="number"
          className="gross-input"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={grossDraft}
          onChange={(event) => setGrossDraft(event.target.value)}
        />
        <label className="owner-submission-override">
          <input
            type="checkbox"
            checked={overridePercent}
            onChange={(event) => {
              setOverridePercent(event.target.checked)
              setPercentDraft(defaultPercentDraft)
            }}
          />
          Override %
        </label>
        <input
          type="number"
          className="gross-input"
          min="0"
          max="100"
          step="0.1"
          placeholder="Override %"
          value={overridePercent ? percentDraft : ''}
          disabled={!overridePercent}
          onChange={(event) => setPercentDraft(event.target.value)}
        />
        <span className="entry-preview">
          {previewNet !== null && previewOwnerCut !== null
            ? `Net ${formatCurrency(previewNet)} · Owner cut ${formatCurrency(previewOwnerCut)}`
            : ''}
        </span>
        <button type="submit" className="btn-outline" disabled={saving}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </form>
      {error && <p className="message message-error">{error}</p>}
    </div>
  )
}

export function OwnerSubmissionsTab({
  activeClients,
  ownerSubmissions,
  ownerSubmissionInvoices,
  clientInvoices,
  currentWeekStart,
  currentWeekEnd,
  onAddOwnerSubmission,
  onDeleteOwnerSubmission,
  onOpenInvoice,
  onOpenPastInvoices,
  pendingContractorsForClient,
}: {
  activeClients: Client[]
  ownerSubmissions: OwnerSubmission[]
  ownerSubmissionInvoices: OwnerSubmissionInvoice[]
  clientInvoices: ClientInvoice[]
  currentWeekStart: string
  currentWeekEnd: string
  onAddOwnerSubmission: (input: {
    category: OwnerSubmissionCategory
    clientId: string
    entryDate: string
    buyerUsername: string
    gross: number
    defaultOwnerCutPercent: number
    ownerCutPercent?: number
  }) => Promise<void>
  onDeleteOwnerSubmission: (entryId: string) => Promise<void>
  onOpenInvoice: (client: Client) => void
  onOpenPastInvoices: (client: Client) => void
  pendingContractorsForClient: (clientId: string) => PendingContractor[]
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>PM Sales</h2>
          <p>
            {formatWeekRange(currentWeekStart, currentWeekEnd)} — log this week's Purchases, Tips, Customs and Sexting per
            client.
          </p>
        </div>
      </div>

      {activeClients.length === 0 ? (
        <p className="info-text">No clients configured yet — add one from Teams, Clients & Sale Types.</p>
      ) : (
        activeClients.map((client) => {
          const clientEntries = ownerSubmissions.filter((entry) => entry.client_id === client.id)
          const totalGross = clientEntries.reduce((sum, entry) => sum + entry.gross, 0)
          const totalNet = clientEntries.reduce((sum, entry) => sum + entry.net, 0)
          const ownerSubmissionsCut = clientEntries
            .filter((entry) => PPV_OWNER_SUBMISSION_CATEGORIES.includes(entry.category))
            .reduce((sum, entry) => sum + entry.owner_cut, 0)
          const sextingSubmissionsCut = clientEntries
            .filter((entry) => SEXTING_OWNER_SUBMISSION_CATEGORIES.includes(entry.category))
            .reduce((sum, entry) => sum + entry.owner_cut, 0)
          const existingInvoice = ownerSubmissionInvoices.find(
            (invoice) => invoice.client_id === client.id && invoice.week_start === currentWeekStart,
          )
          const contractorInvoiceOwnerCut =
            clientInvoices.find((invoice) => invoice.client_id === client.id && invoice.week_start === currentWeekStart)
              ?.owner_cut ?? 0
          const sextingSalesAndCustomsCut = contractorInvoiceOwnerCut + sextingSubmissionsCut
          const pendingContractors = pendingContractorsForClient(client.id)

          return (
            <div key={client.id} className="entry-client" style={clientColorVars(client.color)}>
              <h3>{client.name}</h3>
              {categories.map((category) => (
                <OwnerSubmissionCategoryTable
                  key={category}
                  category={category}
                  client={client}
                  entries={clientEntries.filter((entry) => entry.category === category)}
                  onAdd={onAddOwnerSubmission}
                  onDelete={onDeleteOwnerSubmission}
                />
              ))}

              <h4 className="detail-summary-heading">{client.name} totals this week</h4>
              <div className="detail-summary">
                <div>
                  <p className="label">Gross</p>
                  <strong>{formatCurrency(totalGross)}</strong>
                </div>
                <div>
                  <p className="label">Net</p>
                  <strong>{formatCurrency(totalNet)}</strong>
                </div>
                <div>
                  <p className="label">PPV Purchases &amp; Tips cut</p>
                  <strong>{formatCurrency(ownerSubmissionsCut)}</strong>
                </div>
                <div>
                  <p className="label">Sexting Sales &amp; Customs cut</p>
                  <strong>{formatCurrency(sextingSalesAndCustomsCut)}</strong>
                </div>
                <div>
                  <p className="label">Status</p>
                  <strong>
                    <SubmissionStatusBadge dealtWith={existingInvoice?.dealt_with ?? false} />
                  </strong>
                </div>
              </div>

              {!existingInvoice && pendingContractors.length > 0 && (
                <p className="message message-error">
                  Not all contractors are finalized yet: {pendingContractors.map(pendingContractorLabel).join(', ')}.
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => onOpenPastInvoices(client)}>
                  Past invoices
                </button>
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
