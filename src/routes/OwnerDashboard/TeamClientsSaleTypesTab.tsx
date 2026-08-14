import { useState, type FormEvent } from 'react'
import { ProfileStatusBadge } from '../../components/StatusBadge'
import { paymentMethodLabel, paymentMethods as paymentMethodOptions } from '../../lib/paymentMethods'
import type { Client, PaymentMethodType, Profile, ProfileStatus, SaleType } from '../../types'

function ClientRow({
  clientRow,
  onToggleClient,
  onUpdatePayoutDetails,
  onUpdateNextInvoiceNumber,
}: {
  clientRow: Client
  onToggleClient: (client: Client) => void
  onUpdatePayoutDetails: (client: Client, input: { realName: string; paymentMethod: PaymentMethodType | null }) => void
  onUpdateNextInvoiceNumber: (client: Client, value: number) => void
}) {
  const [realNameDraft, setRealNameDraft] = useState(clientRow.real_name ?? '')
  const [syncedRealName, setSyncedRealName] = useState(clientRow.real_name)

  if (clientRow.real_name !== syncedRealName) {
    setSyncedRealName(clientRow.real_name)
    setRealNameDraft(clientRow.real_name ?? '')
  }

  function saveRealName() {
    if (realNameDraft.trim() === (clientRow.real_name ?? '')) return
    onUpdatePayoutDetails(clientRow, { realName: realNameDraft, paymentMethod: clientRow.payment_method })
  }

  const [invoiceNumberDraft, setInvoiceNumberDraft] = useState(String(clientRow.next_invoice_number))
  const [syncedInvoiceNumber, setSyncedInvoiceNumber] = useState(clientRow.next_invoice_number)

  if (clientRow.next_invoice_number !== syncedInvoiceNumber) {
    setSyncedInvoiceNumber(clientRow.next_invoice_number)
    setInvoiceNumberDraft(String(clientRow.next_invoice_number))
  }

  function saveInvoiceNumber() {
    const value = Number(invoiceNumberDraft)
    if (!Number.isFinite(value) || value < 1 || Math.trunc(value) !== value) {
      setInvoiceNumberDraft(String(clientRow.next_invoice_number))
      return
    }
    if (value === clientRow.next_invoice_number) return
    onUpdateNextInvoiceNumber(clientRow, value)
  }

  return (
    <tr>
      <td>{clientRow.name}</td>
      <td>
        <input
          value={realNameDraft}
          placeholder="Real name"
          onChange={(event) => setRealNameDraft(event.target.value)}
          onBlur={saveRealName}
        />
      </td>
      <td>
        <select
          value={clientRow.payment_method ?? ''}
          onChange={(event) =>
            onUpdatePayoutDetails(clientRow, {
              realName: realNameDraft,
              paymentMethod: (event.target.value || null) as PaymentMethodType | null,
            })
          }
        >
          <option value="">Not set</option>
          {paymentMethodOptions.map((method) => (
            <option key={method} value={method}>
              {paymentMethodLabel[method]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="number"
          min="1"
          step="1"
          className="gross-input"
          value={invoiceNumberDraft}
          onChange={(event) => setInvoiceNumberDraft(event.target.value)}
          onBlur={saveInvoiceNumber}
        />
      </td>
      <td>{clientRow.active ? 'Active' : 'Inactive'}</td>
      <td className="roster-actions">
        <button type="button" className="btn-outline" onClick={() => onToggleClient(clientRow)}>
          {clientRow.active ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  )
}

export function TeamClientsSaleTypesTab({
  workers,
  editingShareId,
  shareDraft,
  shareError,
  rosterError,
  newWorkerName,
  newWorkerEmail,
  newWorkerShare,
  adding,
  addError,
  addMessage,
  onNewWorkerNameChange,
  onNewWorkerEmailChange,
  onNewWorkerShareChange,
  onAddWorker,
  onStartEditShare,
  onShareDraftChange,
  onSaveShare,
  onCancelEditShare,
  onStatusChange,
  onRemove,
  onDeleteWorker,
  clients,
  newClientName,
  addingClient,
  clientError,
  onNewClientNameChange,
  onAddClient,
  onToggleClient,
  onUpdateClientPayoutDetails,
  onUpdateClientNextInvoiceNumber,
  saleTypes,
  newSaleTypeLabel,
  addingSaleType,
  saleTypeError,
  onNewSaleTypeLabelChange,
  onAddSaleType,
  onToggleSaleType,
}: {
  workers: Profile[]
  editingShareId: string | null
  shareDraft: string
  shareError: string | null
  rosterError: string | null
  newWorkerName: string
  newWorkerEmail: string
  newWorkerShare: string
  adding: boolean
  addError: string | null
  addMessage: string | null
  onNewWorkerNameChange: (value: string) => void
  onNewWorkerEmailChange: (value: string) => void
  onNewWorkerShareChange: (value: string) => void
  onAddWorker: (event: FormEvent) => void
  onStartEditShare: (worker: Profile) => void
  onShareDraftChange: (value: string) => void
  onSaveShare: (workerId: string) => void
  onCancelEditShare: () => void
  onStatusChange: (workerId: string, status: ProfileStatus) => void
  onRemove: (worker: Profile) => void
  onDeleteWorker: (worker: Profile) => void
  clients: Client[]
  newClientName: string
  addingClient: boolean
  clientError: string | null
  onNewClientNameChange: (value: string) => void
  onAddClient: (event: FormEvent) => void
  onToggleClient: (client: Client) => void
  onUpdateClientPayoutDetails: (client: Client, input: { realName: string; paymentMethod: PaymentMethodType | null }) => void
  onUpdateClientNextInvoiceNumber: (client: Client, value: number) => void
  saleTypes: SaleType[]
  newSaleTypeLabel: string
  addingSaleType: boolean
  saleTypeError: string | null
  onNewSaleTypeLabelChange: (value: string) => void
  onAddSaleType: (event: FormEvent) => void
  onToggleSaleType: (saleType: SaleType) => void
}) {
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Team</h2>
            <p>Onboard workers and manage access.</p>
          </div>
        </div>

        <form className="add-worker-form" onSubmit={onAddWorker}>
          <label>
            Full name
            <input value={newWorkerName} onChange={(event) => onNewWorkerNameChange(event.target.value)} placeholder="Jordan Lee" />
          </label>
          <label>
            Email
            <input
              type="email"
              value={newWorkerEmail}
              onChange={(event) => onNewWorkerEmailChange(event.target.value)}
              placeholder="jordan@example.com"
            />
          </label>
          <label>
            Owner share %
            <input
              type="number"
              min="0"
              max="100"
              value={newWorkerShare}
              onChange={(event) => onNewWorkerShareChange(event.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={adding}>
            {adding ? 'Adding…' : 'Add worker'}
          </button>
        </form>
        {addError && <p className="message message-error">{addError}</p>}
        {addMessage && <p className="message message-info">{addMessage}</p>}

        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Owner share</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td>{worker.full_name}</td>
                  <td>{worker.email}</td>
                  <td>
                    {editingShareId === worker.id ? (
                      <div className="share-edit">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="share-edit-input"
                          value={shareDraft}
                          onChange={(event) => onShareDraftChange(event.target.value)}
                          autoFocus
                        />
                        <button type="button" className="link-btn" onClick={() => onSaveShare(worker.id)}>
                          Save
                        </button>
                        <button type="button" className="link-btn" onClick={onCancelEditShare}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="share-value" onClick={() => onStartEditShare(worker)}>
                        {worker.owner_share_percent}%
                      </button>
                    )}
                  </td>
                  <td>
                    <ProfileStatusBadge status={worker.status} />
                  </td>
                  <td>
                    <div className="roster-actions">
                      {worker.status === 'active' && (
                        <button type="button" className="btn-outline" onClick={() => onStatusChange(worker.id, 'suspended')}>
                          Suspend
                        </button>
                      )}
                      {worker.status === 'suspended' && (
                        <button type="button" className="btn-outline" onClick={() => onStatusChange(worker.id, 'active')}>
                          Reactivate
                        </button>
                      )}
                      {worker.status !== 'removed' && (
                        <button type="button" className="btn-danger" onClick={() => onRemove(worker)}>
                          Remove
                        </button>
                      )}
                      {worker.status === 'removed' && (
                        <button type="button" className="btn-danger" onClick={() => onDeleteWorker(worker)}>
                          Delete permanently
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {workers.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No workers yet — add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rosterError && <p className="message message-error">{rosterError}</p>}
        {shareError && <p className="message message-error">{shareError}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Clients</h2>
            <p>Clients configured here appear in every worker's day-entry modal.</p>
          </div>
        </div>

        <form className="add-worker-form" onSubmit={onAddClient}>
          <label>
            Client name
            <input value={newClientName} onChange={(event) => onNewClientNameChange(event.target.value)} placeholder="Sav" />
          </label>
          <button type="submit" className="btn-primary" disabled={addingClient}>
            {addingClient ? 'Adding…' : 'Add client'}
          </button>
        </form>
        {clientError && <p className="message message-error">{clientError}</p>}

        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Real name</th>
                <th>Payment method</th>
                <th>Next invoice #</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((clientRow) => (
                <ClientRow
                  key={clientRow.id}
                  clientRow={clientRow}
                  onToggleClient={onToggleClient}
                  onUpdatePayoutDetails={onUpdateClientPayoutDetails}
                  onUpdateNextInvoiceNumber={onUpdateClientNextInvoiceNumber}
                />
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No clients yet — add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Sale types</h2>
            <p>Types configured here populate the Type dropdown for every entry a worker adds.</p>
          </div>
        </div>

        <form className="add-worker-form" onSubmit={onAddSaleType}>
          <label>
            Type name
            <input
              value={newSaleTypeLabel}
              onChange={(event) => onNewSaleTypeLabelChange(event.target.value)}
              placeholder="Unlock"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={addingSaleType}>
            {addingSaleType ? 'Adding…' : 'Add type'}
          </button>
        </form>
        {saleTypeError && <p className="message message-error">{saleTypeError}</p>}

        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {saleTypes.map((saleType) => (
                <tr key={saleType.id}>
                  <td>{saleType.label}</td>
                  <td>{saleType.active ? 'Active' : 'Inactive'}</td>
                  <td className="roster-actions">
                    <button type="button" className="btn-outline" onClick={() => onToggleSaleType(saleType)}>
                      {saleType.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {saleTypes.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-row">
                    No types yet — add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
