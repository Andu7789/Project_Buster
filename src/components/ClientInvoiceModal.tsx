import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { SubmissionStatusBadge } from './StatusBadge'
import { formatCurrency, formatWeekRange } from '../lib/dates'
import { calcClientPayout, calcEarnings, calcOwnerCut, ownerCutPercentForSection, sectionLabel } from '../lib/earnings'
import type { Client, ClientInvoice, Profile, SaleEntry, SaleSection } from '../types'

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
  client,
  clientName,
  weekStart,
  weekEnd,
  entries,
  workers,
  existingInvoice,
  onClose,
  onConfirm,
  onDelete,
}: {
  client: Client | undefined
  clientName: string
  weekStart: string
  weekEnd: string
  entries: SaleEntry[]
  workers: Profile[]
  existingInvoice: ClientInvoice | null
  onClose: () => void
  onConfirm: () => Promise<ClientInvoice>
  onDelete: (invoiceId: string) => Promise<void>
}) {
  const [invoice, setInvoice] = useState<ClientInvoice | null>(existingInvoice)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const bySection = useMemo(() => totalsBySection(entries), [entries])
  const byWorker = useMemo(() => totalsByWorker(entries, workers), [entries, workers])

  const workerCut = sections.reduce((sum, section) => sum + calcEarnings(bySection[section].net, section), 0)
  const ownerCut = sections.reduce(
    (sum, section) => sum + calcOwnerCut(bySection[section].net, ownerCutPercentForSection(client, section)),
    0,
  )
  const clientPayout = sections.reduce(
    (sum, section) => sum + calcClientPayout(bySection[section].net, section, ownerCutPercentForSection(client, section)),
    0,
  )

  const weekLabel = formatWeekRange(weekStart, weekEnd)

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      const confirmed = await onConfirm()
      setInvoice(confirmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm this invoice.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!invoice) return
    const confirmed = window.confirm(`Delete this invoice for ${clientName} (${weekLabel})? This can't be undone.`)
    if (!confirmed) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(invoice.id)
      onClose()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this invoice.')
      setDeleting(false)
    }
  }

  return (
    <Modal title={clientName} onClose={onClose}>
      <p className="modal-subtitle">{weekLabel}</p>

      <div className="detail-summary">
        <div>
          <p className="label">Chatting commission</p>
          <strong>{formatCurrency(workerCut)}</strong>
        </div>
        <div>
          <p className="label">Management commission</p>
          <strong>{formatCurrency(ownerCut)}</strong>
        </div>
        <div>
          <p className="label">Client earnings</p>
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
      {deleteError && <p className="message message-error">{deleteError}</p>}

      <div className="modal-actions modal-actions-split">
        <div>
          {invoice && (
            <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting || saving}>
              {deleting ? 'Deleting…' : 'Delete invoice'}
            </button>
          )}
        </div>
        <div>
          {invoice?.dealt_with ? (
            <p className="message message-info">Confirmed — ready for this week's owner invoice.</p>
          ) : (
            <button type="button" className="btn-primary" onClick={handleConfirm} disabled={saving || deleting || entries.length === 0}>
              {saving ? 'Confirming…' : 'Confirm & mark as checked'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
