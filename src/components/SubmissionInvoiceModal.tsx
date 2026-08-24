import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { ClientSalesDetailModal } from './ClientSalesDetailModal'
import { SubmissionStatusBadge } from './StatusBadge'
import { formatCurrency, formatWeekRange } from '../lib/dates'
import { breakdownByClientAndSection, earningsByClient, ownerCutByClient, sectionLabel, type ClientEarningsTotal } from '../lib/earnings'
import type { Client, SaleEntry, SaleType, Submission } from '../types'

export function SubmissionInvoiceModal({
  submission,
  workerName,
  entries,
  clients,
  saleTypes,
  onClose,
  onConfirm,
  onDelete,
}: {
  submission: Submission
  workerName: string
  entries: SaleEntry[]
  clients: Client[]
  saleTypes: SaleType[]
  onClose: () => void
  onConfirm: (submissionId: string) => Promise<void>
  onDelete: (submissionId: string) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<ClientEarningsTotal | null>(null)

  const breakdown = useMemo(() => breakdownByClientAndSection(entries, clients), [entries, clients])
  const clientTotals = useMemo(() => earningsByClient(entries, clients), [entries, clients])
  const ownerCutTotals = useMemo(() => ownerCutByClient(entries, clients), [entries, clients])

  const weekLabel = formatWeekRange(submission.week_start, submission.week_end)

  async function handleConfirm() {
    setConfirming(true)
    setConfirmError(null)
    try {
      await onConfirm(submission.id)
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Could not mark this submission as agreed.')
    } finally {
      setConfirming(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${workerName}'s submission for ${weekLabel}? This also removes the underlying daily entries and can't be undone.`,
    )
    if (!confirmed) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(submission.id)
      onClose()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this submission.')
      setDeleting(false)
    }
  }

  return (
    <Modal title="Weekly detail" onClose={onClose} wide>
      <p className="modal-subtitle">
        {workerName} — {weekLabel}
      </p>
      <div className="detail-summary">
        <div>
          <p className="label">Current week total</p>
          <strong>{formatCurrency(submission.amount)}</strong>
        </div>
        <div>
          <p className="label">Status</p>
          <strong>
            <SubmissionStatusBadge dealtWith={submission.dealt_with} />
          </strong>
        </div>
      </div>

      <h3>Earnings by client</h3>
      <p className="modal-subtitle">Click a client to see the individual sales behind their total.</p>
      <table className="detail-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Total earnings</th>
          </tr>
        </thead>
        <tbody>
          {clientTotals.map((row) => (
            <tr key={row.clientName} className="submission-row" onClick={() => setSelectedClient(row)}>
              <td>{row.clientName}</td>
              <td>{formatCurrency(row.earnings)}</td>
            </tr>
          ))}
          {clientTotals.length === 0 && (
            <tr>
              <td colSpan={2} className="empty-row">
                No line items recorded for this week.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Owner's cut by client</h3>
      <table className="detail-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Sexting</th>
            <th>Customs/Rates etc</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {ownerCutTotals.map((row) => (
            <tr key={row.clientName}>
              <td>{row.clientName}</td>
              <td>{formatCurrency(row.sexting)}</td>
              <td>{formatCurrency(row.customs)}</td>
              <td>{formatCurrency(row.total)}</td>
            </tr>
          ))}
          {ownerCutTotals.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-row">
                No line items recorded for this week.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Full breakdown</h3>
      <table className="detail-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Section</th>
            <th>Gross</th>
            <th>Net</th>
            <th>Contractor earnings ({workerName})</th>
            <th>Owner earnings</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((row) => (
            <tr key={`${row.clientName}:${row.section}`}>
              <td>{row.clientName}</td>
              <td>{sectionLabel[row.section]}</td>
              <td>{formatCurrency(row.gross)}</td>
              <td>{formatCurrency(row.net)}</td>
              <td>{formatCurrency(row.earnings)}</td>
              <td>{formatCurrency(row.ownerCut)}</td>
            </tr>
          ))}
          {breakdown.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-row">
                No line items recorded for this week.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {submission.notes && (
        <div className="submission-notes">
          <p className="label">Note from worker</p>
          <p>{submission.notes}</p>
        </div>
      )}

      {confirmError && <p className="message message-error">{confirmError}</p>}
      {deleteError && <p className="message message-error">{deleteError}</p>}

      <div className="modal-actions modal-actions-split">
        <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting || confirming}>
          {deleting ? 'Deleting…' : 'Delete submission'}
        </button>
        {submission.dealt_with ? (
          <p className="message message-info">Agreed — ready for this week's owner invoice.</p>
        ) : (
          <button type="button" className="btn-primary" onClick={handleConfirm} disabled={confirming || deleting}>
            {confirming ? 'Marking…' : 'Agree'}
          </button>
        )}
      </div>

      {selectedClient && (
        <ClientSalesDetailModal
          clientName={selectedClient.clientName}
          weekLabel={weekLabel}
          entries={entries.filter((entry) => (entry.client_id ?? null) === selectedClient.clientId)}
          saleTypes={saleTypes}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </Modal>
  )
}
