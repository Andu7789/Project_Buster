import { useMemo } from 'react'
import { Modal } from './Modal'
import { formatCurrency } from '../lib/dates'
import { sectionLabel } from '../lib/earnings'
import type { SaleEntry, SaleType } from '../types'

export function ClientSalesDetailModal({
  clientName,
  weekLabel,
  entries,
  saleTypes,
  onClose,
}: {
  clientName: string
  weekLabel: string
  entries: SaleEntry[]
  saleTypes: SaleType[]
  onClose: () => void
}) {
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)),
    [entries],
  )
  const total = useMemo(() => entries.reduce((sum, entry) => sum + entry.earnings, 0), [entries])

  return (
    <Modal title={clientName} onClose={onClose} wide>
      <p className="modal-subtitle">{weekLabel}</p>

      <div className="table-wrapper">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Section</th>
              <th>Username</th>
              <th>Type</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Earnings</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                <td>{sectionLabel[entry.section]}</td>
                <td>{entry.buyer_username}</td>
                <td>{saleTypes.find((type) => type.id === entry.sale_type_id)?.label ?? '—'}</td>
                <td>{formatCurrency(entry.gross)}</td>
                <td>{formatCurrency(entry.net)}</td>
                <td>{formatCurrency(entry.earnings)}</td>
              </tr>
            ))}
            {sortedEntries.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No sales recorded for this client this week.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>Total</td>
              <td>
                <strong>{formatCurrency(total)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  )
}
