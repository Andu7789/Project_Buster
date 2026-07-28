import { useState } from 'react'
import type { DevRequest, RequestStatus } from '../types'

const statusOptions: { value: RequestStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'needs_info', label: 'Needs owner input' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
]

export function RequestDevControls({
  request,
  onSave,
}: {
  request: DevRequest
  onSave: (input: { status: RequestStatus; progress: number; resolutionNotes: string | null }) => Promise<void>
}) {
  const [status, setStatus] = useState<RequestStatus>(request.status)
  const [progress, setProgress] = useState(request.progress)
  const [notes, setNotes] = useState(request.resolution_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = status !== request.status || progress !== request.progress || notes !== (request.resolution_notes ?? '')

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await onSave({ status, progress, resolutionNotes: notes.trim() || null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this update.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="request-dev-controls">
      <div className="request-form-row">
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as RequestStatus)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Progress ({progress}%)
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
          />
        </label>
      </div>
      <label>
        Note to the owner {status === 'needs_info' ? '(your question)' : '(optional)'}
        <textarea
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="e.g. Which client should this apply to?"
        />
      </label>
      <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || !dirty}>
        {saving ? 'Saving…' : 'Save update'}
      </button>
      {error && <p className="message message-error">{error}</p>}
    </div>
  )
}
