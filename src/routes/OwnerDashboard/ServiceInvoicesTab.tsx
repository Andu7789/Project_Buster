import { useEffect, useState } from 'react'
import {
  createServiceInvoice,
  getNextServiceInvoiceNumber,
  listServiceInvoices,
  updateNextServiceInvoiceNumber,
} from '../../data/queries'
import { toISODate } from '../../lib/dates'
import { generateServiceInvoicePdf } from '../../lib/invoicePdf'
import {
  CUSTOM_SERVICE_DESCRIPTIONS,
  GG_SWAPS_PRESETS,
  presetForDescription,
  SFS_PRESETS,
} from '../../lib/serviceInvoicePresets'
import type { ServiceInvoice, ServiceInvoiceLineItem } from '../../types'

function formatGbp(amountGbp: number): string {
  return `£${amountGbp.toFixed(2)}`
}

function formatDateDisplay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ServiceInvoicesTab() {
  const [invoices, setInvoices] = useState<ServiceInvoice[]>([])
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listServiceInvoices(), getNextServiceInvoiceNumber()])
      .then(([invoiceData, nextNumber]) => {
        if (cancelled) return
        setInvoices(invoiceData)
        setNextInvoiceNumber(nextNumber)
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

  const [nextNumberDraft, setNextNumberDraft] = useState('')
  const [syncedNextNumber, setSyncedNextNumber] = useState<number | null>(null)
  if (nextInvoiceNumber !== syncedNextNumber) {
    setSyncedNextNumber(nextInvoiceNumber)
    setNextNumberDraft(nextInvoiceNumber === null ? '' : String(nextInvoiceNumber))
  }

  async function saveNextNumber() {
    const value = Number(nextNumberDraft)
    if (!Number.isFinite(value) || value < 1 || Math.trunc(value) !== value) {
      setNextNumberDraft(String(nextInvoiceNumber))
      return
    }
    if (value === nextInvoiceNumber) return
    await updateNextServiceInvoiceNumber(value)
    setNextInvoiceNumber(value)
  }

  const [billTo, setBillTo] = useState('')
  const [dateDue, setDateDue] = useState('')
  const [lineItems, setLineItems] = useState<ServiceInvoiceLineItem[]>([])
  const [selectedDescription, setSelectedDescription] = useState('')
  const [amountDraft, setAmountDraft] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const selectedPreset = presetForDescription(selectedDescription)
  const isCustomSelection = CUSTOM_SERVICE_DESCRIPTIONS.includes(selectedDescription)

  function handleSelectDescription(description: string) {
    setSelectedDescription(description)
    const preset = presetForDescription(description)
    setAmountDraft(preset ? preset.amountGbp.toFixed(2) : '')
  }

  function addLineItem() {
    setFormError(null)
    if (!selectedDescription) {
      setFormError('Choose a service.')
      return
    }
    const amountValue = Number(amountDraft)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError('Enter a valid amount.')
      return
    }
    setLineItems((current) => [...current, { description: selectedDescription, amountGbp: amountValue }])
    setSelectedDescription('')
    setAmountDraft('')
  }

  function removeLineItem(index: number) {
    setLineItems((current) => current.filter((_, i) => i !== index))
  }

  const totalGbp = lineItems.reduce((sum, item) => sum + item.amountGbp, 0)

  async function handleGenerate() {
    setFormError(null)
    if (!billTo.trim()) {
      setFormError('Enter who this invoice is for.')
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
    if (nextInvoiceNumber === null) {
      setFormError('Still loading the next invoice number - try again in a moment.')
      return
    }

    setGenerating(true)
    try {
      const dateIssued = toISODate(new Date())
      const invoice = await createServiceInvoice({
        invoiceNumber: nextInvoiceNumber,
        billTo: billTo.trim(),
        dateIssued,
        dateDue,
        lineItems,
        totalGbp,
      })
      await generateServiceInvoicePdf({
        invoiceNumber: invoice.invoice_number,
        dateIssuedIso: invoice.date_issued,
        dateDueIso: invoice.date_due,
        billToName: invoice.bill_to,
        lineItems: invoice.line_items,
        totalGbp: invoice.total_gbp,
      })
      setInvoices((current) => [invoice, ...current])
      setNextInvoiceNumber(nextInvoiceNumber + 1)
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
          <div className="roster-actions service-invoice-settings-row">
            <label>
              Next invoice number
              <input
                type="number"
                min="1"
                step="1"
                className="gross-input"
                value={nextNumberDraft}
                onChange={(event) => setNextNumberDraft(event.target.value)}
                onBlur={saveNextNumber}
              />
            </label>
          </div>

          <form className="add-worker-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              Bill to
              <input value={billTo} onChange={(event) => setBillTo(event.target.value)} placeholder="Customer name" />
            </label>
            <label>
              Date due
              <input type="date" value={dateDue} onChange={(event) => setDateDue(event.target.value)} />
            </label>
          </form>

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
              </optgroup>
            </select>
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
                        onClick={() =>
                          generateServiceInvoicePdf({
                            invoiceNumber: invoice.invoice_number,
                            dateIssuedIso: invoice.date_issued,
                            dateDueIso: invoice.date_due,
                            billToName: invoice.bill_to,
                            lineItems: invoice.line_items,
                            totalGbp: invoice.total_gbp,
                          })
                        }
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
