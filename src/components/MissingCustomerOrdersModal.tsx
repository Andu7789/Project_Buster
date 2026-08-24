import { Modal } from './Modal'
import type { Client, SaleEntry } from '../types'

export interface MissingCustomerOrderRow {
  entry: SaleEntry
  missingFields: string[]
}

export function MissingCustomerOrdersModal({
  rows,
  clients,
  onGoToSubmitCustomerOrder,
  onClose,
}: {
  rows: MissingCustomerOrderRow[]
  clients: Client[]
  onGoToSubmitCustomerOrder: () => void
  onClose: () => void
}) {
  return (
    <Modal title="Finish your customer order forms first" onClose={onClose}>
      <p className="modal-subtitle">
        Every custom you've logged this week needs its order form filled in on the Submit Customer Order tab before
        you can submit your earnings.
      </p>

      <div className="table-wrapper">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Username</th>
              <th>Missing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, missingFields }) => (
              <tr key={entry.id}>
                <td>{new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                <td>{clients.find((client) => client.id === entry.client_id)?.name ?? 'General'}</td>
                <td>{entry.buyer_username}</td>
                <td>{missingFields.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-outline" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn-primary" onClick={onGoToSubmitCustomerOrder}>
          Go to Submit Customer Order
        </button>
      </div>
    </Modal>
  )
}
