import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { SubmissionStatusBadge } from './StatusBadge'
import { formatCurrency, formatWeekRange } from '../lib/dates'
import { sectionLabel } from '../lib/earnings'
import type { Client, SaleEntry, Submission } from '../types'

type Step = 'detail' | 'preview' | 'sent'

interface BreakdownRow {
  clientName: string
  section: SaleEntry['section']
  gross: number
  net: number
  earnings: number
}

function buildBreakdown(entries: SaleEntry[], clients: Client[]): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>()
  for (const entry of entries) {
    const key = `${entry.client_id}:${entry.section}`
    const existing = rows.get(key)
    if (existing) {
      existing.gross += entry.gross
      existing.net += entry.net
      existing.earnings += entry.earnings
      continue
    }
    rows.set(key, {
      clientName: entry.client_id ? clients.find((c) => c.id === entry.client_id)?.name ?? 'Unknown client' : 'General',
      section: entry.section,
      gross: entry.gross,
      net: entry.net,
      earnings: entry.earnings,
    })
  }
  return Array.from(rows.values())
}

export function SubmissionInvoiceModal({
  submission,
  workerName,
  workerEmail,
  entries,
  clients,
  onClose,
  onSendInvoice,
}: {
  submission: Submission
  workerName: string
  workerEmail: string
  entries: SaleEntry[]
  clients: Client[]
  onClose: () => void
  onSendInvoice: (submissionId: string) => Promise<void>
}) {
  const [step, setStep] = useState<Step>('detail')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const breakdown = useMemo(() => buildBreakdown(entries, clients), [entries, clients])
  const invoiceAmount = submission.amount

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      await onSendInvoice(submission.id)
      setStep('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the invoice.')
    } finally {
      setSending(false)
    }
  }

  const weekLabel = formatWeekRange(submission.week_start, submission.week_end)

  if (step === 'preview') {
    return (
      <Modal title="Invoice preview" onClose={onClose}>
        <p className="modal-subtitle">
          {workerName} — {weekLabel}
        </p>

        <div className="invoice-lines">
          <div className="invoice-line invoice-line-total">
            <span>Invoice amount</span>
            <span>{formatCurrency(invoiceAmount)}</span>
          </div>
        </div>

        <p className="info-text">
          This will be emailed to {workerEmail} once email delivery is connected. For now, sending marks this
          submission as invoiced.
        </p>

        {error && <p className="message message-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={() => setStep('detail')} disabled={sending}>
            Back
          </button>
          <button type="button" className="btn-primary" onClick={handleSend} disabled={sending}>
            {sending ? 'Sending…' : 'Send invoice email'}
          </button>
        </div>
      </Modal>
    )
  }

  if (step === 'sent') {
    return (
      <Modal title="Invoice sent" onClose={onClose}>
        <p className="modal-subtitle">
          {workerName} — {weekLabel}
        </p>
        <div className="invoice-sent">
          <strong>{formatCurrency(invoiceAmount)}</strong>
          <p>
            Invoice email simulated to {workerEmail}. Real email delivery isn't wired up yet, but this submission is
            now marked as invoiced.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      </Modal>
    )
  }

  return (
    <Modal title="Weekly detail" onClose={onClose}>
      <p className="modal-subtitle">
        {workerName} — {weekLabel}
      </p>
      <div className="detail-summary">
        <div>
          <p className="label">Total earned</p>
          <strong>{formatCurrency(submission.amount)}</strong>
        </div>
        <div>
          <p className="label">Status</p>
          <strong>
            <SubmissionStatusBadge dealtWith={submission.dealt_with} />
          </strong>
        </div>
      </div>

      <table className="detail-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Section</th>
            <th>Gross</th>
            <th>Net</th>
            <th>Earnings</th>
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
            </tr>
          ))}
          {breakdown.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-row">
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

      {submission.dealt_with ? (
        <p className="message message-info">Invoice already created for this week.</p>
      ) : (
        <button type="button" className="btn-primary" onClick={() => setStep('preview')}>
          Create invoice
        </button>
      )}
    </Modal>
  )
}
