import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/authContext'
import { listSubmissionsForWorker, submitTimesheet } from '../data/queries'
import { daysOfWeek, formatCurrency, formatWeekRange, getCurrentWeekRange } from '../lib/dates'
import type { Profile, Submission } from '../types'
import { PortalHeader } from '../components/PortalHeader'
import { SubmissionStatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'

function parseAmount(raw: string): number | null {
  if (raw.trim() === '') return 0
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

export function WorkerDashboard({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()
  const [entries, setEntries] = useState<Record<string, string>>({})
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)

  const { weekStart, weekEnd } = useMemo(() => getCurrentWeekRange(), [])

  useEffect(() => {
    let cancelled = false
    listSubmissionsForWorker(profile.id)
      .then((data) => {
        if (!cancelled) setSubmissions(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your timesheets.')
      })
      .finally(() => {
        if (!cancelled) setLoadingSubmissions(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile.id])

  const alreadySubmittedThisWeek = submissions.some((submission) => submission.week_start === weekStart)
  const lifetimeTotal = useMemo(() => submissions.reduce((sum, submission) => sum + submission.amount, 0), [submissions])
  const liveTotal = useMemo(() => {
    return daysOfWeek.reduce((sum, day) => {
      const parsed = parseAmount(entries[day] ?? '')
      return sum + (parsed ?? 0)
    }, 0)
  }, [entries])

  const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId) ?? null

  function handleEntryChange(day: string, value: string) {
    setEntries((prev) => ({ ...prev, [day]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setMessage(null)

    const dayAmounts: Record<string, number> = {}
    for (const day of daysOfWeek) {
      const parsed = parseAmount(entries[day] ?? '')
      if (parsed === null) {
        setFormError(`Enter a valid amount for ${day}, or leave it blank.`)
        return
      }
      if (parsed > 0) dayAmounts[day] = parsed
    }

    const total = Object.values(dayAmounts).reduce((sum, value) => sum + value, 0)
    if (!total) {
      setFormError('Enter at least one amount before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const created = await submitTimesheet({
        workerId: profile.id,
        weekStart,
        weekEnd,
        dayAmounts,
        amount: total,
        ownerSharePercent: profile.owner_share_percent,
      })
      setSubmissions((previous) => [created, ...previous])
      setEntries({})
      setMessage('Weekly submission sent to your employer.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit your timesheet.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-shell">
      <PortalHeader portalLabel="Worker portal" userName={profile.full_name} onSignOut={signOut} />

      <section className="panel worker-panel">
        <div className="panel-head">
          <div>
            <h2>This week</h2>
            <p>{formatWeekRange(weekStart, weekEnd)}</p>
          </div>
        </div>

        {alreadySubmittedThisWeek ? (
          <p className="info-text">
            You've already submitted this week's timesheet. It's in your history below — reach out to your employer if
            it needs a change.
          </p>
        ) : (
          <form className="stack" onSubmit={handleSubmit}>
            <div className="day-grid">
              {daysOfWeek.map((day) => (
                <label key={day} className="day-card">
                  <span>{day}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entries[day] ?? ''}
                    onChange={(event) => handleEntryChange(day, event.target.value)}
                    placeholder="0.00"
                  />
                </label>
              ))}
            </div>

            <div className="summary-card">
              <strong>Current week total</strong>
              <p className="summary-figure">{formatCurrency(liveTotal)}</p>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit timesheet'}
            </button>
            {formError && <p className="message message-error">{formError}</p>}
            {message && <p className="message message-info">{message}</p>}
          </form>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Past timesheets</h2>
            <p>View-only — submitted timesheets can't be edited.</p>
          </div>
          <div className="summary-card summary-card-inline">
            <span className="stat-label">Lifetime submitted</span>
            <strong>{formatCurrency(lifetimeTotal)}</strong>
          </div>
        </div>

        {loadingSubmissions ? (
          <p className="info-text">Loading your timesheets…</p>
        ) : loadError ? (
          <p className="message message-error">{loadError}</p>
        ) : (
          <div className="table-wrapper">
            <table className="submission-table">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className="submission-row"
                    onClick={() => setSelectedSubmissionId(submission.id)}
                  >
                    <td>{formatWeekRange(submission.week_start, submission.week_end)}</td>
                    <td>{formatCurrency(submission.amount)}</td>
                    <td>
                      <SubmissionStatusBadge dealtWith={submission.dealt_with} />
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-row">
                      No timesheets submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedSubmission && (
        <Modal title="Timesheet detail" onClose={() => setSelectedSubmissionId(null)}>
          <p className="modal-subtitle">{formatWeekRange(selectedSubmission.week_start, selectedSubmission.week_end)}</p>
          <div className="detail-summary">
            <div>
              <p className="label">Total submitted</p>
              <strong>{formatCurrency(selectedSubmission.amount)}</strong>
            </div>
            <div>
              <p className="label">Status</p>
              <strong>
                <SubmissionStatusBadge dealtWith={selectedSubmission.dealt_with} />
              </strong>
            </div>
          </div>

          <table className="detail-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(selectedSubmission.day_amounts).map(([day, amount]) => (
                <tr key={day}>
                  <td>{day}</td>
                  <td>{formatCurrency(amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  )
}
