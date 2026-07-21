import { useState } from 'react'
import { Modal } from './Modal'
import { SubmissionStatusBadge } from './StatusBadge'
import { formatCurrency, formatWeekRange } from '../lib/dates'
import type { Submission } from '../types'

type Step = 'detail' | 'preview' | 'sent'

export function SubmissionInvoiceModal({
  submission,
  workerName,
  workerEmail,
  onClose,
  onSendInvoice,
}: {
  submission: Submission
  workerName: string
  workerEmail: string
  onClose: () => void
  onSendInvoice: (submissionId: string) => Promise<void>
}) {
  const [step, setStep] = useState<Step>('detail')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ownerShareAmount = submission.amount * (submission.owner_share_percent / 100)
  const invoiceAmount = submission.amount - ownerShareAmount

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
          <div className="invoice-line">
            <span>Total submitted</span>
            <span>{formatCurrency(submission.amount)}</span>
          </div>
          <div className="invoice-line invoice-line-deduct">
            <span>Owner share ({submission.owner_share_percent}%)</span>
            <span>−{formatCurrency(ownerShareAmount)}</span>
          </div>
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
          <p className="label">Total submitted</p>
          <strong>{formatCurrency(submission.amount)}</strong>
        </div>
        <div>
          <p className="label">Owner share</p>
          <strong>{formatCurrency(ownerShareAmount)}</strong>
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
            <th>Day</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(submission.day_amounts).map(([day, amount]) => (
            <tr key={day}>
              <td>{day}</td>
              <td>{formatCurrency(amount)}</td>
            </tr>
          ))}
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
