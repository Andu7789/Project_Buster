import { useState } from 'react'
import { Modal } from './Modal'
import { SubmissionStatusBadge } from './StatusBadge'
import { formatCurrency, formatWeekRange } from '../lib/dates'
import type { OwnerSubmissionInvoice } from '../types'

type Step = 'list' | 'detail' | 'confirm-delete'

export function PastOwnerInvoicesModal({
  clientName,
  invoices,
  onClose,
  onDelete,
}: {
  clientName: string
  invoices: OwnerSubmissionInvoice[]
  onClose: () => void
  onDelete: (invoiceId: string) => Promise<void>
}) {
  const [step, setStep] = useState<Step>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedInvoices = [...invoices].sort((a, b) => b.week_start.localeCompare(a.week_start))
  const selected = sortedInvoices.find((invoice) => invoice.id === selectedId) ?? null

  function openDetail(invoiceId: string) {
    setSelectedId(invoiceId)
    setError(null)
    setStep('detail')
  }

  async function handleDelete() {
    if (!selected) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(selected.id)
      setStep('list')
      setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this invoice.')
    } finally {
      setDeleting(false)
    }
  }

  if (step === 'confirm-delete' && selected) {
    return (
      <Modal title="Delete this invoice?" onClose={onClose}>
        <p className="modal-subtitle">
          {clientName} — {formatWeekRange(selected.week_start, selected.week_end)}
        </p>
        <p className="info-text">
          This permanently removes this week's owner invoice record ({formatCurrency(selected.combined_owner_cut)}
          combined owner cut). This can't be undone.
        </p>
        {error && <p className="message message-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={() => setStep('detail')} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete invoice'}
          </button>
        </div>
      </Modal>
    )
  }

  if (step === 'detail' && selected) {
    return (
      <Modal title={clientName} onClose={onClose}>
        <p className="modal-subtitle">{formatWeekRange(selected.week_start, selected.week_end)}</p>

        <div className="invoice-lines">
          <div className="invoice-line">
            <span>Owner submissions cut</span>
            <span>{formatCurrency(selected.owner_submissions_cut)}</span>
          </div>
          <div className="invoice-line">
            <span>Client invoice owner cut</span>
            <span>{formatCurrency(selected.client_invoice_owner_cut)}</span>
          </div>
          <div className="invoice-line invoice-line-total">
            <span>Combined owner cut</span>
            <span>{formatCurrency(selected.combined_owner_cut)}</span>
          </div>
        </div>

        <p className="info-text">
          Status: <SubmissionStatusBadge dealtWith={selected.dealt_with} />
        </p>

        {error && <p className="message message-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={() => setStep('list')}>
            Back to list
          </button>
          <button type="button" className="btn-danger" onClick={() => setStep('confirm-delete')}>
            Delete invoice
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`${clientName} — past invoices`} onClose={onClose}>
      <p className="modal-subtitle">Select a week to review its figures or delete it.</p>

      <div className="table-wrapper">
        <table className="submission-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Combined owner cut</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedInvoices.map((invoice) => (
              <tr key={invoice.id} className="submission-row" onClick={() => openDetail(invoice.id)}>
                <td>{formatWeekRange(invoice.week_start, invoice.week_end)}</td>
                <td>{formatCurrency(invoice.combined_owner_cut)}</td>
                <td>
                  <SubmissionStatusBadge dealtWith={invoice.dealt_with} />
                </td>
              </tr>
            ))}
            {sortedInvoices.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-row">
                  No past invoices for this client yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
