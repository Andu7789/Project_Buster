import { useState } from 'react'
import { CustomerOrderModal } from '../../components/CustomerOrderModal'
import { CustomerOrderStatusBadge } from '../../components/StatusBadge'
import { formatCurrency, formatWeekRange } from '../../lib/dates'
import { isCustomerOrderComplete } from '../../lib/customerOrders'
import type { Client, CustomerOrder, SaleEntry, SaleType } from '../../types'

function CustomsOrderTable({
  entries,
  clients,
  saleTypes,
  customerOrders,
  onRowClick,
}: {
  entries: SaleEntry[]
  clients: Client[]
  saleTypes: SaleType[]
  customerOrders: CustomerOrder[]
  onRowClick: (entry: SaleEntry) => void
}) {
  if (entries.length === 0) {
    return <p className="info-text">No customs/rates entries logged for this week yet.</p>
  }

  return (
    <div className="table-wrapper">
      <table className="detail-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Client</th>
            <th>Username</th>
            <th>Type</th>
            <th>Gross</th>
            <th>Order form</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const order = customerOrders.find((candidate) => candidate.sale_entry_id === entry.id)
            return (
              <tr key={entry.id} className="customer-order-row" onClick={() => onRowClick(entry)}>
                <td>{new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                <td>{clients.find((client) => client.id === entry.client_id)?.name ?? 'General'}</td>
                <td>{entry.buyer_username}</td>
                <td>{saleTypes.find((type) => type.id === entry.sale_type_id)?.label ?? '—'}</td>
                <td>{formatCurrency(entry.gross)}</td>
                <td>
                  <CustomerOrderStatusBadge complete={isCustomerOrderComplete(order)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SubmitCustomerOrderTab({
  workerId,
  weekStart,
  weekEnd,
  entries,
  clients,
  saleTypes,
  customerOrders,
  showLastWeek,
  previousWeekStart,
  previousWeekEnd,
  previousEntries,
  onOrderSaved,
}: {
  workerId: string
  weekStart: string
  weekEnd: string
  entries: SaleEntry[]
  clients: Client[]
  saleTypes: SaleType[]
  customerOrders: CustomerOrder[]
  showLastWeek: boolean
  previousWeekStart: string
  previousWeekEnd: string
  previousEntries: SaleEntry[]
  onOrderSaved: (order: CustomerOrder) => void
}) {
  const [openEntry, setOpenEntry] = useState<SaleEntry | null>(null)

  const customsEntries = entries.filter((entry) => entry.section === 'customs')
  const previousCustomsEntries = previousEntries.filter((entry) => entry.section === 'customs')

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>This week</h2>
            <p>{formatWeekRange(weekStart, weekEnd)} — click a row to fill in its order form.</p>
          </div>
        </div>
        <CustomsOrderTable
          entries={customsEntries}
          clients={clients}
          saleTypes={saleTypes}
          customerOrders={customerOrders}
          onRowClick={setOpenEntry}
        />
      </section>

      {showLastWeek && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Last week</h2>
              <p>{formatWeekRange(previousWeekStart, previousWeekEnd)} — click a row to fill in its order form.</p>
            </div>
          </div>
          <CustomsOrderTable
            entries={previousCustomsEntries}
            clients={clients}
            saleTypes={saleTypes}
            customerOrders={customerOrders}
            onRowClick={setOpenEntry}
          />
        </section>
      )}

      {openEntry && (
        <CustomerOrderModal
          entry={openEntry}
          clientName={clients.find((client) => client.id === openEntry.client_id)?.name ?? 'General'}
          workerId={workerId}
          order={customerOrders.find((candidate) => candidate.sale_entry_id === openEntry.id)}
          onSaved={onOrderSaved}
          onClose={() => setOpenEntry(null)}
        />
      )}
    </>
  )
}
