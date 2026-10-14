import { Fragment, useEffect, useState } from 'react'
import { listAllCustomerOrders } from '../../data/queries'
import { CustomerOrderStatusBadge } from '../../components/StatusBadge'
import { customOrderTypeLabel, customOrderTypesNeedingDetail, isCustomerOrderComplete } from '../../lib/customerOrders'
import { formatCurrency } from '../../lib/dates'
import type { Client, CustomerOrderWithEntry, Profile } from '../../types'

function typeLabel(order: CustomerOrderWithEntry): string {
  if (!order.custom_type) return '-'
  const base = customOrderTypeLabel[order.custom_type]
  return customOrderTypesNeedingDetail.includes(order.custom_type) && order.custom_type_other?.trim()
    ? `${base} (${order.custom_type_other.trim()})`
    : base
}

function yesNo(value: boolean | null): string {
  return value == null ? '-' : value ? 'Yes' : 'No'
}

export function CustomerOrdersTab({ workers, clients }: { workers: Profile[]; clients: Client[] }) {
  const [orders, setOrders] = useState<CustomerOrderWithEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listAllCustomerOrders()
      .then((data) => {
        if (!cancelled) setOrders(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load customer orders.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleOrders = clientFilter ? orders.filter((order) => order.sale_entry?.client_id === clientFilter) : orders

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Customer Orders</h2>
          <p>Every custom order form workers have filled in. Complete ones are sent to the client on Telegram.</p>
        </div>
        <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} aria-label="Filter by client">
          <option value="">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="info-text">Loading…</p>
      ) : error ? (
        <p className="message message-error">{error}</p>
      ) : visibleOrders.length === 0 ? (
        <p className="info-text">No customer orders yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Worker</th>
                <th>Username</th>
                <th>Type</th>
                <th>Gross</th>
                <th>Form</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const expanded = expandedId === order.id
                const entry = order.sale_entry
                return (
                  <Fragment key={order.id}>
                    <tr>
                      <td>
                        {entry
                          ? new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '-'}
                      </td>
                      <td>{clients.find((client) => client.id === entry?.client_id)?.name ?? 'General'}</td>
                      <td>{workers.find((worker) => worker.id === order.worker_id)?.full_name ?? 'Unknown worker'}</td>
                      <td>{entry?.buyer_username ?? '-'}</td>
                      <td>{typeLabel(order)}</td>
                      <td>{entry ? formatCurrency(entry.gross) : '-'}</td>
                      <td>
                        <CustomerOrderStatusBadge complete={isCustomerOrderComplete(order)} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-outline"
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : order.id)}
                        >
                          {expanded ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={8}>
                          <dl className="stack">
                            <div>
                              <dt className="label">Profile link</dt>
                              <dd>
                                {order.profile_link ? (
                                  <a href={order.profile_link} target="_blank" rel="noopener noreferrer">
                                    {order.profile_link}
                                  </a>
                                ) : (
                                  '-'
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="label">Information on the custom</dt>
                              <dd style={{ whiteSpace: 'pre-wrap' }}>{order.custom_info || '-'}</dd>
                            </div>
                            <div>
                              <dt className="label">Pinned the relevant messages</dt>
                              <dd>{yesNo(order.pinned_messages)}</dd>
                            </div>
                            <div>
                              <dt className="label">Added to the waiting for content list</dt>
                              <dd>{yesNo(order.added_to_waiting_list)}</dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
