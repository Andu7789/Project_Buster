import { useState } from 'react'
import { paymentMethodFields, paymentMethodLabel, paymentMethods as paymentMethodOptions } from '../../lib/paymentMethods'
import type { PaymentMethodType, WorkerPaymentDetails } from '../../types'

export function PaymentDetailsTab({
  paymentDetails,
  onSave,
}: {
  paymentDetails: WorkerPaymentDetails | null
  onSave: (method: PaymentMethodType, details: Record<string, string>) => Promise<void>
}) {
  const [method, setMethod] = useState<PaymentMethodType | ''>(paymentDetails?.method ?? '')
  const [draft, setDraft] = useState<Record<string, string>>(paymentDetails?.details ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleMethodChange(next: PaymentMethodType) {
    setMethod(next)
    setSaved(false)
    setDraft(next === paymentDetails?.method ? paymentDetails.details : {})
  }

  async function handleSave() {
    setError(null)
    setSaved(false)
    if (!method) {
      setError('Choose a payment method.')
      return
    }
    setSaving(true)
    try {
      await onSave(method, draft)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your payment details.')
    } finally {
      setSaving(false)
    }
  }

  const fields = method ? paymentMethodFields[method] : []

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Payment details</h2>
          <p>Where you'd like to be paid. Only you and the owner can see this.</p>
        </div>
      </div>

      <div className="stack">
        <label>
          Payment method
          <select value={method} onChange={(event) => handleMethodChange(event.target.value as PaymentMethodType)}>
            <option value="">Select a method…</option>
            {paymentMethodOptions.map((option) => (
              <option key={option} value={option}>
                {paymentMethodLabel[option]}
              </option>
            ))}
          </select>
        </label>

        {fields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              value={draft[field.key] ?? ''}
              onChange={(event) => setDraft((previous) => ({ ...previous, [field.key]: event.target.value }))}
            />
          </label>
        ))}

        {method && (
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}

        {error && <p className="message message-error">{error}</p>}
        {saved && !error && <p className="message message-info">Saved.</p>}
      </div>
    </section>
  )
}
