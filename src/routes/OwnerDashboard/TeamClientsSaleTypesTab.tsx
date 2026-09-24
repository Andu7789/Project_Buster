import { useState, type FormEvent } from 'react'
import { ProfileStatusBadge } from '../../components/StatusBadge'
import { ClientColorPicker } from '../../components/ClientColorPicker'
import {
  invoiceFrequencies as invoiceFrequencyOptions,
  invoiceFrequencyLabel,
  paymentMethodLabel,
  paymentMethods as paymentMethodOptions,
} from '../../lib/paymentMethods'
import type { Client, InvoiceFrequency, PaymentMethodType, Profile, ProfileStatus, SaleType, ServiceClient } from '../../types'

function ClientRow({
  clientRow,
  onToggleClient,
  onUpdatePayoutDetails,
  onUpdateTelegramChatId,
  onUpdateNextInvoiceNumber,
  onUpdateColor,
}: {
  clientRow: Client
  onToggleClient: (client: Client) => void
  onUpdatePayoutDetails: (client: Client, input: { realName: string; paymentMethod: PaymentMethodType | null }) => void
  onUpdateTelegramChatId: (client: Client, telegramChatId: string) => void
  onUpdateNextInvoiceNumber: (client: Client, value: number) => void
  onUpdateColor: (client: Client, color: string) => void
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

  const [telegramChatIdDraft, setTelegramChatIdDraft] = useState(clientRow.telegram_chat_id ?? '')
  const [syncedTelegramChatId, setSyncedTelegramChatId] = useState(clientRow.telegram_chat_id)

  if (clientRow.telegram_chat_id !== syncedTelegramChatId) {
    setSyncedTelegramChatId(clientRow.telegram_chat_id)
    setTelegramChatIdDraft(clientRow.telegram_chat_id ?? '')
  }

  function saveTelegramChatId() {
    if (telegramChatIdDraft.trim() === (clientRow.telegram_chat_id ?? '')) return
    onUpdateTelegramChatId(clientRow, telegramChatIdDraft)
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
        <ClientColorPicker
          value={clientRow.color}
          onChange={(color) => onUpdateColor(clientRow, color)}
          label={`Change ${clientRow.name}'s color`}
        />
      </td>
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
      <td>
        <input
          value={telegramChatIdDraft}
          placeholder="Telegram chat ID"
          onChange={(event) => setTelegramChatIdDraft(event.target.value)}
          onBlur={saveTelegramChatId}
        />
      </td>
      <td>{clientRow.active ? 'Active' : 'Inactive'}</td>
      <td>
        <div className="roster-actions">
          <button type="button" className="btn-outline" onClick={() => onToggleClient(clientRow)}>
            {clientRow.active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </td>
    </tr>
  )
}

function formatLastInvoiced(lastInvoicedAt: string | null): string {
  if (!lastInvoicedAt) return 'Never'
  return new Date(lastInvoicedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ServiceClientRow({
  serviceClient,
  onToggle,
  onDelete,
  onUpdatePaymentMethod,
  onUpdateInvoiceFrequency,
  onUpdateNextInvoiceNumber,
}: {
  serviceClient: ServiceClient
  onToggle: (serviceClient: ServiceClient) => void
  onDelete: (serviceClient: ServiceClient) => void
  onUpdatePaymentMethod: (serviceClient: ServiceClient, paymentMethod: PaymentMethodType | null) => void
  onUpdateInvoiceFrequency: (serviceClient: ServiceClient, invoiceFrequency: InvoiceFrequency | null) => void
  onUpdateNextInvoiceNumber: (serviceClient: ServiceClient, value: number) => void
}) {
  const [invoiceNumberDraft, setInvoiceNumberDraft] = useState(String(serviceClient.next_invoice_number))
  const [syncedInvoiceNumber, setSyncedInvoiceNumber] = useState(serviceClient.next_invoice_number)

  if (serviceClient.next_invoice_number !== syncedInvoiceNumber) {
    setSyncedInvoiceNumber(serviceClient.next_invoice_number)
    setInvoiceNumberDraft(String(serviceClient.next_invoice_number))
  }

  function saveInvoiceNumber() {
    const value = Number(invoiceNumberDraft)
    if (!Number.isFinite(value) || value < 1 || Math.trunc(value) !== value) {
      setInvoiceNumberDraft(String(serviceClient.next_invoice_number))
      return
    }
    if (value === serviceClient.next_invoice_number) return
    onUpdateNextInvoiceNumber(serviceClient, value)
  }

  return (
    <tr>
      <td>{serviceClient.name}</td>
      <td>
        <select
          value={serviceClient.payment_method ?? ''}
          onChange={(event) => onUpdatePaymentMethod(serviceClient, (event.target.value || null) as PaymentMethodType | null)}
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
        <select
          value={serviceClient.invoice_frequency ?? ''}
          onChange={(event) =>
            onUpdateInvoiceFrequency(serviceClient, (event.target.value || null) as InvoiceFrequency | null)
          }
        >
          <option value="">Not set</option>
          {invoiceFrequencyOptions.map((frequency) => (
            <option key={frequency} value={frequency}>
              {invoiceFrequencyLabel[frequency]}
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
      <td>{formatLastInvoiced(serviceClient.last_invoiced_at)}</td>
      <td>{serviceClient.active ? 'Active' : 'Inactive'}</td>
      <td>
        <div className="roster-actions">
          <button type="button" className="btn-outline" onClick={() => onToggle(serviceClient)}>
            {serviceClient.active ? 'Deactivate' : 'Activate'}
          </button>
          <button type="button" className="btn-outline" onClick={() => onDelete(serviceClient)}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

function PercentField({ value, onSave }: { value: number; onSave: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const [synced, setSynced] = useState(value)

  if (value !== synced) {
    setSynced(value)
    setDraft(String(value))
  }

  function save() {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setDraft(String(value))
      return
    }
    if (parsed === value) return
    onSave(parsed)
  }

  return (
    <input
      type="number"
      min="0"
      max="100"
      step="0.1"
      className="gross-input"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
    />
  )
}

function ClientOwnerPercentRow({
  clientRow,
  onUpdateOwnerPercents,
}: {
  clientRow: Client
  onUpdateOwnerPercents: (
    client: Client,
    input: { pmSalesOwnerPercent: number; sextingOwnerPercent: number; customsOwnerPercent: number },
  ) => void
}) {
  return (
    <tr>
      <td>{clientRow.name}</td>
      <td>
        <PercentField
          value={clientRow.pm_sales_owner_percent}
          onSave={(value) =>
            onUpdateOwnerPercents(clientRow, {
              pmSalesOwnerPercent: value,
              sextingOwnerPercent: clientRow.sexting_owner_percent,
              customsOwnerPercent: clientRow.customs_owner_percent,
            })
          }
        />
      </td>
      <td>
        <PercentField
          value={clientRow.sexting_owner_percent}
          onSave={(value) =>
            onUpdateOwnerPercents(clientRow, {
              pmSalesOwnerPercent: clientRow.pm_sales_owner_percent,
              sextingOwnerPercent: value,
              customsOwnerPercent: clientRow.customs_owner_percent,
            })
          }
        />
      </td>
      <td>
        <PercentField
          value={clientRow.customs_owner_percent}
          onSave={(value) =>
            onUpdateOwnerPercents(clientRow, {
              pmSalesOwnerPercent: clientRow.pm_sales_owner_percent,
              sextingOwnerPercent: clientRow.sexting_owner_percent,
              customsOwnerPercent: value,
            })
          }
        />
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
  newClientColor,
  addingClient,
  clientError,
  onNewClientNameChange,
  onNewClientColorChange,
  onAddClient,
  onToggleClient,
  onUpdateClientPayoutDetails,
  onUpdateClientTelegramChatId,
  onUpdateClientNextInvoiceNumber,
  onUpdateClientOwnerPercents,
  onUpdateClientColor,
  serviceClients,
  newServiceClientName,
  newServiceClientPaymentMethod,
  newServiceClientInvoiceFrequency,
  addingServiceClient,
  serviceClientError,
  onNewServiceClientNameChange,
  onNewServiceClientPaymentMethodChange,
  onNewServiceClientInvoiceFrequencyChange,
  onAddServiceClient,
  onToggleServiceClient,
  onDeleteServiceClient,
  onUpdateServiceClientPaymentMethod,
  onUpdateServiceClientInvoiceFrequency,
  onUpdateServiceClientNextInvoiceNumber,
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
  newClientColor: string
  addingClient: boolean
  clientError: string | null
  onNewClientNameChange: (value: string) => void
  onNewClientColorChange: (value: string) => void
  onAddClient: (event: FormEvent) => void
  onToggleClient: (client: Client) => void
  onUpdateClientPayoutDetails: (client: Client, input: { realName: string; paymentMethod: PaymentMethodType | null }) => void
  onUpdateClientTelegramChatId: (client: Client, telegramChatId: string) => void
  onUpdateClientNextInvoiceNumber: (client: Client, value: number) => void
  onUpdateClientColor: (client: Client, color: string) => void
  onUpdateClientOwnerPercents: (
    client: Client,
    input: { pmSalesOwnerPercent: number; sextingOwnerPercent: number; customsOwnerPercent: number },
  ) => void
  serviceClients: ServiceClient[]
  newServiceClientName: string
  newServiceClientPaymentMethod: PaymentMethodType | null
  newServiceClientInvoiceFrequency: InvoiceFrequency | null
  addingServiceClient: boolean
  serviceClientError: string | null
  onNewServiceClientNameChange: (value: string) => void
  onNewServiceClientPaymentMethodChange: (value: PaymentMethodType | null) => void
  onNewServiceClientInvoiceFrequencyChange: (value: InvoiceFrequency | null) => void
  onAddServiceClient: (event: FormEvent) => void
  onToggleServiceClient: (serviceClient: ServiceClient) => void
  onDeleteServiceClient: (serviceClient: ServiceClient) => void
  onUpdateServiceClientPaymentMethod: (serviceClient: ServiceClient, paymentMethod: PaymentMethodType | null) => void
  onUpdateServiceClientInvoiceFrequency: (serviceClient: ServiceClient, invoiceFrequency: InvoiceFrequency | null) => void
  onUpdateServiceClientNextInvoiceNumber: (serviceClient: ServiceClient, value: number) => void
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
          <label>
            Color
            <ClientColorPicker value={newClientColor} onChange={onNewClientColorChange} label="Choose a color for this client" />
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
                <th>Color</th>
                <th>Real name</th>
                <th>Payment method</th>
                <th>Next invoice #</th>
                <th>Telegram chat ID</th>
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
                  onUpdateTelegramChatId={onUpdateClientTelegramChatId}
                  onUpdateNextInvoiceNumber={onUpdateClientNextInvoiceNumber}
                  onUpdateColor={onUpdateClientColor}
                />
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    No clients yet — add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="table-header">
          <h3>Management commission %</h3>
          <p>How much of each client's earnings the owner keeps, by transaction type.</p>
        </div>
        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>PM Sales %</th>
                <th>Sexting %</th>
                <th>Customs %</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((clientRow) => (
                <ClientOwnerPercentRow key={clientRow.id} clientRow={clientRow} onUpdateOwnerPercents={onUpdateClientOwnerPercents} />
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
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
            <h2>Service clients</h2>
            <p>Clients who only buy standalone services (GG Swaps, SFS, admin) - no color or commission split needed.</p>
          </div>
        </div>

        <form className="add-worker-form" onSubmit={onAddServiceClient}>
          <label>
            Client name
            <input
              value={newServiceClientName}
              onChange={(event) => onNewServiceClientNameChange(event.target.value)}
              placeholder="Client name"
            />
          </label>
          <label>
            Payment method
            <select
              value={newServiceClientPaymentMethod ?? ''}
              onChange={(event) => onNewServiceClientPaymentMethodChange((event.target.value || null) as PaymentMethodType | null)}
            >
              <option value="">Not set</option>
              {paymentMethodOptions.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabel[method]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Invoice frequency
            <select
              value={newServiceClientInvoiceFrequency ?? ''}
              onChange={(event) =>
                onNewServiceClientInvoiceFrequencyChange((event.target.value || null) as InvoiceFrequency | null)
              }
            >
              <option value="">Not set</option>
              {invoiceFrequencyOptions.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {invoiceFrequencyLabel[frequency]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary" disabled={addingServiceClient}>
            {addingServiceClient ? 'Adding…' : 'Add service client'}
          </button>
        </form>
        {serviceClientError && <p className="message message-error">{serviceClientError}</p>}

        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Payment method</th>
                <th>Invoice frequency</th>
                <th>Next invoice #</th>
                <th>Last invoiced</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {serviceClients.map((serviceClient) => (
                <ServiceClientRow
                  key={serviceClient.id}
                  serviceClient={serviceClient}
                  onToggle={onToggleServiceClient}
                  onDelete={onDeleteServiceClient}
                  onUpdatePaymentMethod={onUpdateServiceClientPaymentMethod}
                  onUpdateInvoiceFrequency={onUpdateServiceClientInvoiceFrequency}
                  onUpdateNextInvoiceNumber={onUpdateServiceClientNextInvoiceNumber}
                />
              ))}
              {serviceClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No service clients yet — add your first one above.
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
                  <td>
                    <div className="roster-actions">
                      <button type="button" className="btn-outline" onClick={() => onToggleSaleType(saleType)}>
                        {saleType.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
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
