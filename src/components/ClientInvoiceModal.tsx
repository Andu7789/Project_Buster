import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { SubmissionStatusBadge } from './StatusBadge'
import { formatCurrency, formatWeekRange } from '../lib/dates'
import { calcClientPayout, calcEarnings, calcOwnerCut, sectionLabel } from '../lib/earnings'
import type { ClientInvoice, Profile, SaleEntry, SaleSection } from '../types'

type Step = 'detail' | 'preview' | 'sent'

const sections: SaleSection[] = ['sexting', 'customs']

interface SectionTotals {
  gross: number
  net: number
}

function totalsBySection(entries: SaleEntry[]): Record<SaleSection, SectionTotals> {
  const totals: Record<SaleSection, SectionTotals> = {
    sexting: { gross: 0, net: 0 },
    customs: { gross: 0, net: 0 },
  }
  for (const entry of entries) {
    totals[entry.section].gross += entry.gross
    totals[entry.section].net += entry.net
  }
  return totals
}

function totalsByWorker(entries: SaleEntry[], workers: Profile[]): { name: string; earnings: number }[] {
  const totals = new Map<string, number>()
  for (const entry of entries) {
    totals.set(entry.worker_id, (totals.get(entry.worker_id) ?? 0) + entry.earnings)
  }
  return Array.from(totals.entries()).map(([workerId, earnings]) => ({
    name: workers.find((w) => w.id === workerId)?.full_name ?? 'Unknown worker',
    earnings,
  }))
}

export function ClientInvoiceModal({
  clientName,
  weekStart,
  weekEnd,
  entries,
  workers,
  existingInvoice,
  onClose,
  onCreateInvoice,
  onSendInvoice,
}: {
  clientName: string
  weekStart: string
  weekEnd: string
  entries: SaleEntry[]
  workers: Profile[]
  existingInvoice: ClientInvoice | null
  onClose: () => void
  onCreateInvoice: () => Promise<ClientInvoice>
  onSendInvoice: (invoiceId: string) => Promise<void>
}) {
  const [step, setStep] = useState<Step>(existingInvoice?.dealt_with ? 'sent' : 'detail')
  const [invoice, setInvoice] = useState<ClientInvoice | null>(existingInvoice)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bySection = useMemo(() => totalsBySection(entries), [entries])
  const byWorker = useMemo(() => totalsByWorker(entries, workers), [entries, workers])

  const workerCut = sections.reduce((sum, section) => sum + calcEarnings(bySection[section].net, section), 0)
  const ownerCut = sections.reduce((sum, section) => sum + calcOwnerCut(bySection[section].net, section), 0)
  const clientPayout = sections.reduce((sum, section) => sum + calcClientPayout(bySection[section].net, section), 0)

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

  if (step === 'sent') {
    return (
      <Modal title="Invoice sent" onClose={onClose}>
        <p className="modal-subtitle">
          {clientName} — {weekLabel}
        </p>
        <div className="invoice-lines">
          <div className="invoice-line invoice-line-total">
            <span>Client payout</span>
            <span>{formatCurrency(invoice?.client_payout ?? clientPayout)}</span>
          </div>
          <div className="invoice-line">
            <span>Owner payout</span>
            <span>{formatCurrency(invoice?.owner_cut ?? ownerCut)}</span>
          </div>
        </div>
        <p className="info-text">
          Invoice simulated to {clientName}. Telegram delivery isn't wired up yet, but this week is now marked as
          invoiced.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={() => setStep('detail')}>
            View breakdown
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    )
  }

  if (step === 'preview' && invoice) {
    return (
      <Modal title="Invoice preview" onClose={onClose}>
        <p className="modal-subtitle">
          {clientName} — {weekLabel}
        </p>

        <div className="invoice-lines">
          <div className="invoice-line">
            <span>Worker cut</span>
            <span>{formatCurrency(invoice.worker_cut)}</span>
          </div>
          <div className="invoice-line">
            <span>Owner cut</span>
            <span>{formatCurrency(invoice.owner_cut)}</span>
          </div>
          <div className="invoice-line invoice-line-total">
            <span>Client payout</span>
            <span>{formatCurrency(invoice.client_payout)}</span>
          </div>
        </div>

        <p className="info-text">
          This will be sent to {clientName} via Telegram once that's connected. For now, sending marks this week as
          invoiced.
        </p>

        {error && <p className="message message-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={() => setStep('detail')} disabled={saving}>
            Back
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
          <p className="label">Worker cut</p>
          <strong>{formatCurrency(workerCut)}</strong>
        </div>
        <div>
          <p className="label">Owner cut</p>
          <strong>{formatCurrency(ownerCut)}</strong>
        </div>
        <div>
          <p className="label">Client payout</p>
          <strong>{formatCurrency(clientPayout)}</strong>
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
            <th>Section</th>
            <th>Gross</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <tr key={section}>
              <td>{sectionLabel[section]}</td>
              <td>{formatCurrency(bySection[section].gross)}</td>
              <td>{formatCurrency(bySection[section].net)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="detail-table">
        <thead>
          <tr>
            <th>Worker</th>
            <th>Earnings</th>
          </tr>
        </thead>
        <tbody>
          {byWorker.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{formatCurrency(row.earnings)}</td>
            </tr>
          ))}
          {byWorker.length === 0 && (
            <tr>
              <td colSpan={2} className="empty-row">
                No entries recorded for this week.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {error && <p className="message message-error">{error}</p>}

      {invoice?.dealt_with ? (
        <button type="button" className="btn-primary" onClick={() => setStep('sent')}>
          View summary
        </button>
      ) : invoice ? (
        <button type="button" className="btn-primary" onClick={() => setStep('preview')}>
          Continue to send
        </button>
      ) : (
        <button type="button" className="btn-primary" onClick={handleCreate} disabled={saving || entries.length === 0}>
          {saving ? 'Creating…' : 'Create invoice'}
        </button>
      )}
    </Modal>
  )
}
