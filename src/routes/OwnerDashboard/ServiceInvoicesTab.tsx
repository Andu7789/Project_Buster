import { useEffect, useState } from 'react'
import {
  createServiceInvoice,
  listClients,
  listPaymentMethods,
  listServiceClients,
  listServiceInvoices,
  markServiceClientInvoiced,
  updateClientNextInvoiceNumber,
} from '../../data/queries'
import { toISODate } from '../../lib/dates'
import { generateServiceInvoicePdf } from '../../lib/invoicePdf'
import { paymentMethodFields, paymentMethodLabel } from '../../lib/paymentMethods'
import {
  CUSTOM_SERVICE_DESCRIPTIONS,
  CUSTOM_SERVICE_OPTION,
  GG_SWAPS_PRESETS,
  presetForDescription,
  SFS_PRESETS,
} from '../../lib/serviceInvoicePresets'
import type { Client, PaymentMethod, PaymentMethodType, ServiceClient, ServiceInvoice, ServiceInvoiceLineItem } from '../../types'

function formatGbp(amountGbp: number): string {
  return `£${amountGbp.toFixed(2)}`
}

function formatDateDisplay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Either roster a "bill to" name can resolve to - whichever one it came from is whose
 * next_invoice_number gets used and advanced, so a client billed from both (e.g. a PM client
 * who also buys GG Swaps) shares one running invoice sequence across both invoice types. */
type BillToTarget = { kind: 'client'; record: Client } | { kind: 'serviceClient'; record: ServiceClient }

export function ServiceInvoicesTab() {
  const [invoices, setInvoices] = useState<ServiceInvoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [serviceClients, setServiceClients] = useState<ServiceClient[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listServiceInvoices(), listClients(), listServiceClients(), listPaymentMethods()])
      .then(([invoiceData, clientData, serviceClientData, paymentMethodData]) => {
        if (cancelled) return
        setInvoices(invoiceData)
        setClients(clientData)
        setServiceClients(serviceClientData)
        setPaymentMethods(paymentMethodData)
        setLoadError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Could not load service invoices.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const billToNames = Array.from(
    new Set([
      ...clients.filter((client) => client.active).map((client) => client.name),
      ...serviceClients.filter((serviceClient) => serviceClient.active).map((serviceClient) => serviceClient.name),
    ]),
  ).sort((a, b) => a.localeCompare(b))

  function resolveBillTo(name: string): BillToTarget | null {
    const client = clients.find((entry) => entry.name === name)
    if (client) return { kind: 'client', record: client }
    const serviceClient = serviceClients.find((entry) => entry.name === name)
    if (serviceClient) return { kind: 'serviceClient', record: serviceClient }
    return null
  }

  /** The owner's saved payout details for the method this bill-to is set to pay by - the same
   *  lookup owner invoices use, rendered as "Payment Method" on the service invoice PDF. */
  function paymentDetailsFor(method: PaymentMethodType | null): { label: string | null; lines: string[] } {
    if (!method) return { label: null, lines: [] }
    const methodDetails = paymentMethods.find((entry) => entry.method === method)?.details
    const lines = paymentMethodFields[method]
      .map((field) => ({ label: field.label, value: methodDetails?.[field.key]?.trim() ?? '' }))
      .filter((field) => field.value !== '')
      .map((field) => `${field.label}: ${field.value}`)
    return { label: paymentMethodLabel[method], lines }
  }

  /** Resolves a saved invoice back to its bill-to record so its current payment method can be looked up. */
  function billToRecordForInvoice(invoice: ServiceInvoice): Client | ServiceClient | null {
    if (invoice.client_id) return clients.find((entry) => entry.id === invoice.client_id) ?? null
    if (invoice.service_client_id) return serviceClients.find((entry) => entry.id === invoice.service_client_id) ?? null
    return null
  }

  const [billTo, setBillTo] = useState('')
  const [dateDue, setDateDue] = useState('')
  const [lineItems, setLineItems] = useState<ServiceInvoiceLineItem[]>([])
  const [selectedDescription, setSelectedDescription] = useState('')
  const [customDescriptionDraft, setCustomDescriptionDraft] = useState('')
  const [amountDraft, setAmountDraft] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const billToTarget = billTo ? resolveBillTo(billTo) : null

  const selectedPreset = presetForDescription(selectedDescription)
  const isCustomSelection = CUSTOM_SERVICE_DESCRIPTIONS.includes(selectedDescription)
  const isOtherSelection = selectedDescription === CUSTOM_SERVICE_OPTION

  function handleSelectDescription(description: string) {
    setSelectedDescription(description)
    setCustomDescriptionDraft('')
    const preset = presetForDescription(description)
    setAmountDraft(preset ? preset.amountGbp.toFixed(2) : '')
  }

  function addLineItem() {
    setFormError(null)
    if (!selectedDescription) {
      setFormError('Choose a service.')
      return
    }
    const description = isOtherSelection ? customDescriptionDraft.trim() : selectedDescription
    if (!description) {
      setFormError('Enter a description.')
      return
    }
    const amountValue = Number(amountDraft)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError('Enter a valid amount.')
      return
    }
    setLineItems((current) => [...current, { description, amountGbp: amountValue }])
    setSelectedDescription('')
    setCustomDescriptionDraft('')
    setAmountDraft('')
  }

  function removeLineItem(index: number) {
    setLineItems((current) => current.filter((_, i) => i !== index))
  }

  const totalGbp = lineItems.reduce((sum, item) => sum + item.amountGbp, 0)

  async function handleGenerate() {
    setFormError(null)
    if (!billTo) {
      setFormError('Choose who this invoice is for.')
      return
    }
    const target = resolveBillTo(billTo)
    if (!target) {
      setFormError('Could not find that client - try choosing them again.')
      return
    }
    if (!dateDue) {
      setFormError('Choose a date due.')
      return
    }
    if (lineItems.length === 0) {
      setFormError('Add at least one service.')
      return
    }

    setGenerating(true)
    try {
      const dateIssued = toISODate(new Date())
      const invoiceNumber = target.record.next_invoice_number
      const invoice = await createServiceInvoice({
        invoiceNumber,
        billTo,
        billToClientId: target.kind === 'client' ? target.record.id : null,
        billToServiceClientId: target.kind === 'serviceClient' ? target.record.id : null,
        dateIssued,
        dateDue,
        lineItems,
        totalGbp,
      })
      const payment = paymentDetailsFor(target.record.payment_method)
      await generateServiceInvoicePdf({
        invoiceNumber: invoice.invoice_number,
        dateIssuedIso: invoice.date_issued,
        dateDueIso: invoice.date_due,
        billToName: invoice.bill_to,
        lineItems: invoice.line_items,
        totalGbp: invoice.total_gbp,
        paymentMethodLabel: payment.label,
        paymentMethodLines: payment.lines,
      })

      if (target.kind === 'client') {
        const updated = await updateClientNextInvoiceNumber(target.record.id, invoiceNumber + 1)
        setClients((previous) => previous.map((c) => (c.id === updated.id ? updated : c)))
      } else {
        const updated = await markServiceClientInvoiced(target.record.id, {
          nextInvoiceNumber: invoiceNumber + 1,
          lastInvoicedAt: dateIssued,
        })
        setServiceClients((previous) => previous.map((c) => (c.id === updated.id ? updated : c)))
      }

      setInvoices((current) => [invoice, ...current])
      setBillTo('')
      setDateDue('')
      setLineItems([])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not generate this invoice.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Service Invoices</h2>
          <p>GG Swaps, SFS and admin/scheduling invoices - billed in GBP only, separate from client sale invoices.</p>
        </div>
      </div>

      {loading ? (
        <p className="info-text">Loading…</p>
      ) : loadError ? (
        <p className="message message-error">{loadError}</p>
      ) : (
        <>
          <form className="add-worker-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              Bill to
              <select value={billTo} onChange={(event) => setBillTo(event.target.value)}>
                <option value="">Choose a client…</option>
                {billToNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date due
              <input type="date" value={dateDue} onChange={(event) => setDateDue(event.target.value)} />
            </label>
          </form>

          {billToTarget && (
            <p className="info-text">
              This will be invoice #{billToTarget.record.next_invoice_number} for {billTo} - continuing their own invoice sequence
              {billToTarget.kind === 'client' ? ' (shared with their PM invoices).' : '.'}
            </p>
          )}

          <div className="table-wrapper">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Service Description</th>
                  <th>Total (GBP)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={`${item.description}-${index}`}>
                    <td>{item.description}</td>
                    <td>{formatGbp(item.amountGbp)}</td>
                    <td>
                      <button type="button" className="btn-danger" onClick={() => removeLineItem(index)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {lineItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-row">
                      No services added yet.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td colSpan={2}>
                    <strong>{formatGbp(totalGbp)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="service-invoice-add-row">
            <select value={selectedDescription} onChange={(event) => handleSelectDescription(event.target.value)}>
              <option value="">Choose a service…</option>
              <optgroup label="GG Swaps">
                {GG_SWAPS_PRESETS.map((preset) => (
                  <option key={preset.description} value={preset.description}>
                    {preset.description} - {formatGbp(preset.amountGbp)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="SFS">
                {SFS_PRESETS.map((preset) => (
                  <option key={preset.description} value={preset.description}>
                    {preset.description} - {formatGbp(preset.amountGbp)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Priced individually">
                {CUSTOM_SERVICE_DESCRIPTIONS.map((description) => (
                  <option key={description} value={description}>
                    {description}
                  </option>
                ))}
                <option value={CUSTOM_SERVICE_OPTION}>{CUSTOM_SERVICE_OPTION}</option>
              </optgroup>
            </select>
            {isOtherSelection && (
              <input
                type="text"
                className="gross-input"
                placeholder="Description"
                value={customDescriptionDraft}
                onChange={(event) => setCustomDescriptionDraft(event.target.value)}
              />
            )}
            <input
              type="number"
              min="0"
              step="0.01"
              className="gross-input"
              placeholder="Amount (GBP)"
              value={amountDraft}
              onChange={(event) => setAmountDraft(event.target.value)}
              readOnly={Boolean(selectedPreset) && !isCustomSelection}
            />
            <button type="button" className="btn-outline" onClick={addLineItem}>
              Add service
            </button>
          </div>

          {formError && <p className="message message-error">{formError}</p>}

          <button
            type="button"
            className="btn-primary service-invoice-generate-btn"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating…' : 'Generate invoice'}
          </button>

          <h4 className="detail-summary-heading">Invoice history</h4>
          <div className="table-wrapper">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Bill to</th>
                  <th>Date issued</th>
                  <th>Date due</th>
                  <th>Total (GBP)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>#{invoice.invoice_number}</td>
                    <td>{invoice.bill_to}</td>
                    <td>{formatDateDisplay(invoice.date_issued)}</td>
                    <td>{formatDateDisplay(invoice.date_due)}</td>
                    <td>{formatGbp(invoice.total_gbp)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          const record = billToRecordForInvoice(invoice)
                          const payment = paymentDetailsFor(record?.payment_method ?? null)
                          generateServiceInvoicePdf({
                            invoiceNumber: invoice.invoice_number,
                            dateIssuedIso: invoice.date_issued,
                            dateDueIso: invoice.date_due,
                            billToName: invoice.bill_to,
                            lineItems: invoice.line_items,
                            totalGbp: invoice.total_gbp,
                            paymentMethodLabel: payment.label,
                            paymentMethodLines: payment.lines,
                          })
                        }}
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No service invoices yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
