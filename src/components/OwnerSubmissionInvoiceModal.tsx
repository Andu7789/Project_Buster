import { useState } from 'react'
import { Modal } from './Modal'
import { SubmissionStatusBadge } from './StatusBadge'
import { formatCurrency, formatWeekRange } from '../lib/dates'
import { ownerSubmissionCategoryLabel } from '../lib/earnings'
import type { OwnerSubmissionInvoice, PendingContractor } from '../types'

type Step = 'detail' | 'gate' | 'preview' | 'sent'

function pendingContractorLabel(contractor: PendingContractor): string {
  return contractor.status === 'not_submitted' ? 'not submitted yet' : 'submitted, awaiting your confirmation'
}

export function OwnerSubmissionInvoiceModal({
  clientName,
  weekStart,
  weekEnd,
  subscriptionsOwnerCut,
  tipsOwnerCut,
  livestreamsOwnerCut,
  ownerSubmissionsCut,
  clientInvoiceOwnerCut,
  hasClientInvoice,
  existingInvoice,
  pendingContractors,
  onClose,
  onCreateInvoice,
  onSendInvoice,
  onDownloadPdf,
}: {
  clientName: string
  weekStart: string
  weekEnd: string
  subscriptionsOwnerCut: number
  tipsOwnerCut: number
  livestreamsOwnerCut: number
  ownerSubmissionsCut: number
  clientInvoiceOwnerCut: number
  hasClientInvoice: boolean
  existingInvoice: OwnerSubmissionInvoice | null
  pendingContractors: PendingContractor[]
  onClose: () => void
  onCreateInvoice: () => Promise<OwnerSubmissionInvoice>
  onSendInvoice: (invoiceId: string) => Promise<void>
  onDownloadPdf: () => void
}) {
  const [step, setStep] = useState<Step>('detail')
  const [invoice, setInvoice] = useState<OwnerSubmissionInvoice | null>(existingInvoice)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const combinedOwnerCut = ownerSubmissionsCut + clientInvoiceOwnerCut
  const weekLabel = formatWeekRange(weekStart, weekEnd)

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const created = await onCreateInvoice()
      setInvoice(created)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the invoice.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSend() {
    if (!invoice) return
    setSaving(true)
    setError(null)
    try {
      await onSendInvoice(invoice.id)
      setStep('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the invoice.')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'sent' || invoice?.dealt_with) {
    return (
      <Modal title="Invoice sent" onClose={onClose}>
        <p className="modal-subtitle">
          {clientName} — {weekLabel}
        </p>
        <div className="invoice-sent">
          <strong>{formatCurrency(invoice?.combined_owner_cut ?? combinedOwnerCut)}</strong>
          <p>This week's owner invoice is marked as sent.</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={onDownloadPdf}>
            Download dummy PDF
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    )
  }

  if (step === 'gate') {
    return (
      <Modal title="Not all contractors are finalized" onClose={onClose}>
        <p className="modal-subtitle">
          {clientName} — {weekLabel}
        </p>

        <p className="info-text">
          This invoice combines this week's owner submissions with the client invoice owner cut, but not every
          contractor who logged work for {clientName} this week has submitted their timesheet and been confirmed as
          checked yet:
        </p>

        <ul className="pending-contractor-list">
          {pendingContractors.map((contractor) => (
            <li key={contractor.name}>
              <strong>{contractor.name}</strong> — {pendingContractorLabel(contractor)}
            </li>
          ))}
        </ul>

        <p className="info-text">
          Creating the invoice now uses today's figures and won't automatically update if those contractors' entries
          change later.
        </p>

        {error && <p className="message message-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={() => setStep('detail')} disabled={saving}>
            Go back
          </button>
          <button type="button" className="btn-danger" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create invoice anyway'}
          </button>
        </div>
      </Modal>
    )
  }

  if (step === 'preview' && invoice) {
    return (
      <Modal title="Owner invoice preview" onClose={onClose}>
        <p className="modal-subtitle">
          {clientName} — {weekLabel}
        </p>

        <div className="invoice-lines">
          <div className="invoice-line">
            <span>Owner submissions cut</span>
            <span>{formatCurrency(invoice.owner_submissions_cut)}</span>
          </div>
          <div className="invoice-line">
            <span>Client invoice owner cut</span>
            <span>{formatCurrency(invoice.client_invoice_owner_cut)}</span>
          </div>
          <div className="invoice-line invoice-line-total">
            <span>Combined owner cut</span>
            <span>{formatCurrency(invoice.combined_owner_cut)}</span>
          </div>
        </div>

        <p className="info-text">
          These two totals appear on page one of the PDF invoice, with contractor entries and owner submissions
          listed separately on the pages after.
        </p>

        {error && <p className="message message-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={() => setStep('detail')} disabled={saving}>
            Back
          </button>
          <button type="button" className="btn-outline" onClick={onDownloadPdf}>
            Download dummy PDF
          </button>
          <button type="button" className="btn-primary" onClick={handleSend} disabled={saving}>
            {saving ? 'Sending…' : 'Send invoice'}
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={clientName} onClose={onClose}>
      <p className="modal-subtitle">{weekLabel}</p>

      <div className="detail-summary">
        <div>
          <p className="label">{ownerSubmissionCategoryLabel.subscriptions}</p>
          <strong>{formatCurrency(subscriptionsOwnerCut)}</strong>
        </div>
        <div>
          <p className="label">{ownerSubmissionCategoryLabel.tips}</p>
          <strong>{formatCurrency(tipsOwnerCut)}</strong>
        </div>
        <div>
          <p className="label">{ownerSubmissionCategoryLabel.livestreams}</p>
          <strong>{formatCurrency(livestreamsOwnerCut)}</strong>
        </div>
        <div>
          <p className="label">Client invoice owner cut</p>
          <strong>{formatCurrency(clientInvoiceOwnerCut)}</strong>
        </div>
        <div>
          <p className="label">Combined owner cut</p>
          <strong>{formatCurrency(combinedOwnerCut)}</strong>
        </div>
        <div>
          <p className="label">Status</p>
          <strong>
            <SubmissionStatusBadge dealtWith={invoice?.dealt_with ?? false} />
          </strong>
        </div>
      </div>

      <table className="detail-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Owner cut</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{ownerSubmissionCategoryLabel.subscriptions}</td>
            <td>{formatCurrency(subscriptionsOwnerCut)}</td>
          </tr>
          <tr>
            <td>{ownerSubmissionCategoryLabel.tips}</td>
            <td>{formatCurrency(tipsOwnerCut)}</td>
          </tr>
          <tr>
            <td>{ownerSubmissionCategoryLabel.livestreams}</td>
            <td>{formatCurrency(livestreamsOwnerCut)}</td>
          </tr>
        </tbody>
      </table>

      {!hasClientInvoice && (
        <p className="message message-info">
          No client invoice has been created yet for this week — the client invoice owner cut above will show as $0
          until one is created from the Submissions & Invoices tab.
        </p>
      )}

      {!invoice && pendingContractors.length > 0 && (
        <p className="message message-error">
          Not all contractors are finalized yet — {pendingContractors.length === 1 ? 'one contractor' : `${pendingContractors.length} contractors`} who
          logged work for {clientName} this week still need to submit and be confirmed as checked.
        </p>
      )}

      {error && <p className="message message-error">{error}</p>}

      {invoice ? (
        <button type="button" className="btn-primary" onClick={() => setStep('preview')}>
          Continue to send
        </button>
      ) : (
        <button
          type="button"
          className="btn-primary"
          onClick={() => (pendingContractors.length > 0 ? setStep('gate') : handleCreate())}
          disabled={saving}
        >
          {saving ? 'Creating…' : 'Create invoice'}
        </button>
      )}
    </Modal>
  )
}
