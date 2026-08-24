import { useState } from 'react'
import { Modal } from './Modal'
import { upsertCustomerOrder } from '../data/queries'
import { customOrderTypeLabel, customOrderTypes } from '../lib/customerOrders'
import type { CustomerOrder, CustomOrderType, SaleEntry } from '../types'

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (value: boolean) => void
}) {
  return (
    <div className="yes-no-field">
      <span className="label">{label}</span>
      <div className="yes-no-options">
        <label className="yes-no-option">
          <input type="radio" checked={value === true} onChange={() => onChange(true)} />
          Yes
        </label>
        <label className="yes-no-option">
          <input type="radio" checked={value === false} onChange={() => onChange(false)} />
          No
        </label>
      </div>
    </div>
  )
}

export function CustomerOrderModal({
  entry,
  clientName,
  workerId,
  order,
  onSaved,
  onClose,
}: {
  entry: SaleEntry
  clientName: string
  workerId: string
  order: CustomerOrder | undefined
  onSaved: (order: CustomerOrder) => void
  onClose: () => void
}) {
  const [customType, setCustomType] = useState<CustomOrderType | ''>(order?.custom_type ?? '')
  const [customTypeOther, setCustomTypeOther] = useState(order?.custom_type_other ?? '')
  const [profileLink, setProfileLink] = useState(order?.profile_link ?? '')
  const [customInfo, setCustomInfo] = useState(order?.custom_info ?? '')
  const [pinnedMessages, setPinnedMessages] = useState<boolean | null>(order?.pinned_messages ?? null)
  const [addedToWaitingList, setAddedToWaitingList] = useState<boolean | null>(order?.added_to_waiting_list ?? null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError(null)
    if (!customType) {
      setError('Choose a type of custom.')
      return
    }
    if (customType === 'panties_other' && !customTypeOther.trim()) {
      setError('Specify the type of custom.')
      return
    }
    if (!profileLink.trim()) {
      setError("Enter a link to the user's profile.")
      return
    }
    if (!customInfo.trim()) {
      setError('Enter information on the custom.')
      return
    }
    if (pinnedMessages === null) {
      setError('Say whether you\'ve pinned the relevant messages.')
      return
    }
    if (addedToWaitingList === null) {
      setError('Say whether you\'ve added the user to the \'waiting for content\' list.')
      return
    }

    setSaving(true)
    try {
      const saved = await upsertCustomerOrder({
        saleEntryId: entry.id,
        workerId,
        customType,
        customTypeOther: customType === 'panties_other' ? customTypeOther.trim() : null,
        profileLink,
        customInfo,
        pinnedMessages,
        addedToWaitingList,
      })
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this customer order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Submit customer order" onClose={onClose}>
      <p className="modal-subtitle">
        {clientName} · {entry.buyer_username} ·{' '}
        {new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </p>

      <div className="stack">
        <label>
          Type of custom
          <select value={customType} onChange={(event) => setCustomType(event.target.value as CustomOrderType)}>
            <option value="">Select a type…</option>
            {customOrderTypes.map((type) => (
              <option key={type} value={type}>
                {customOrderTypeLabel[type]}
              </option>
            ))}
          </select>
        </label>

        {customType === 'panties_other' && (
          <label>
            Specify the type of custom
            <input
              value={customTypeOther}
              onChange={(event) => setCustomTypeOther(event.target.value)}
              placeholder="e.g. worn socks"
            />
          </label>
        )}

        <label>
          Username
          <input value={entry.buyer_username} disabled />
        </label>

        <label>
          Link to user's profile
          <input value={profileLink} onChange={(event) => setProfileLink(event.target.value)} placeholder="https://..." />
        </label>

        <label>
          Information on the custom
          <textarea
            value={customInfo}
            onChange={(event) => setCustomInfo(event.target.value)}
            rows={4}
            placeholder="What they asked for…"
          />
        </label>

        <YesNoField
          label="Have you pinned the relevant messages on the client's page?"
          value={pinnedMessages}
          onChange={setPinnedMessages}
        />

        <YesNoField
          label="Have you added the user to the 'waiting for content' list?"
          value={addedToWaitingList}
          onChange={setAddedToWaitingList}
        />

        {error && <p className="message message-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
