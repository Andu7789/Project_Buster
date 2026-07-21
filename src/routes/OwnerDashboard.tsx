import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/authContext'
import { addWorker, listAllSubmissions, listWorkers, markDealtWith, setWorkerStatus, updateWorkerShare } from '../data/queries'
import { formatCurrency, formatWeekRange } from '../lib/dates'
import type { Profile, ProfileStatus, Submission } from '../types'
import { PortalHeader } from '../components/PortalHeader'
import { StatCard } from '../components/StatCard'
import { ProfileStatusBadge, SubmissionStatusBadge } from '../components/StatusBadge'
import { SubmissionInvoiceModal } from '../components/SubmissionInvoiceModal'
import { WeekTrendChart } from '../components/WeekTrendChart'

export function OwnerDashboard({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()

  const [workers, setWorkers] = useState<Profile[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [rosterError, setRosterError] = useState<string | null>(null)

  const [newWorkerName, setNewWorkerName] = useState('')
  const [newWorkerEmail, setNewWorkerEmail] = useState('')
  const [newWorkerShare, setNewWorkerShare] = useState('20')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addMessage, setAddMessage] = useState<string | null>(null)

  const [editingShareId, setEditingShareId] = useState<string | null>(null)
  const [shareDraft, setShareDraft] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listWorkers(), listAllSubmissions()])
      .then(([workerData, submissionData]) => {
        if (cancelled) return
        setWorkers(workerData)
        setSubmissions(submissionData)
        setSelectedWorkerId((current) => current ?? workerData[0]?.id ?? null)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load dashboard data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activeWorkers = workers.filter((worker) => worker.status === 'active').length
  const pendingInvites = workers.filter((worker) => worker.status === 'pending').length
  const pendingSubmissions = submissions.filter((submission) => !submission.dealt_with).length

  const totalThisMonth = useMemo(() => {
    const now = new Date()
    return submissions
      .filter((submission) => {
        const start = new Date(submission.week_start)
        return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()
      })
      .reduce((sum, submission) => sum + submission.amount, 0)
  }, [submissions])

  const trendData = useMemo(() => {
    const totals = new Map<string, number>()
    for (const submission of submissions) {
      totals.set(submission.week_start, (totals.get(submission.week_start) ?? 0) + submission.amount)
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([weekStart, total]) => ({
        label: new Date(weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        total,
      }))
  }, [submissions])

  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId) ?? null
  const selectedWorkerSubmissions = submissions.filter((submission) => submission.worker_id === selectedWorkerId)
  const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId) ?? null

  async function handleAddWorker(event: FormEvent) {
    event.preventDefault()
    setAddError(null)
    setAddMessage(null)

    const name = newWorkerName.trim()
    const email = newWorkerEmail.trim().toLowerCase()
    const share = Number(newWorkerShare)

    if (!name || !email) {
      setAddError('Enter a name and email.')
      return
    }
    if (!Number.isFinite(share) || share < 0 || share > 100) {
      setAddError('Owner share must be a number between 0 and 100.')
      return
    }

    setAdding(true)
    try {
      const created = await addWorker({ fullName: name, email, ownerSharePercent: share })
      setWorkers((previous) => {
        const index = previous.findIndex((worker) => worker.id === created.id)
        if (index === -1) return [...previous, created]
        const next = [...previous]
        next[index] = created
        return next
      })
      setNewWorkerName('')
      setNewWorkerEmail('')
      setNewWorkerShare('20')
      setAddMessage(
        created.status === 'active'
          ? `${created.full_name} restored - they can sign back in with their existing login.`
          : `${created.full_name} added. They can sign up at the worker portal using ${created.email}.`,
      )
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add worker.')
    } finally {
      setAdding(false)
    }
  }

  function startEditShare(worker: Profile) {
    setEditingShareId(worker.id)
    setShareDraft(String(worker.owner_share_percent))
    setShareError(null)
  }

  async function handleSaveShare(workerId: string) {
    const value = Number(shareDraft)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setShareError('Enter a number between 0 and 100.')
      return
    }
    try {
      await updateWorkerShare(workerId, value)
      setWorkers((previous) => previous.map((worker) => (worker.id === workerId ? { ...worker, owner_share_percent: value } : worker)))
      setEditingShareId(null)
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not update share.')
    }
  }

  async function handleStatusChange(workerId: string, status: ProfileStatus) {
    setRosterError(null)
    try {
      await setWorkerStatus(workerId, status)
      setWorkers((previous) => previous.map((worker) => (worker.id === workerId ? { ...worker, status } : worker)))
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Could not update this worker.')
    }
  }

  function handleRemove(worker: Profile) {
    const confirmed = window.confirm(
      `Remove ${worker.full_name}? Their timesheet history is kept, but they'll be signed out and can't log in again.`,
    )
    if (confirmed) handleStatusChange(worker.id, 'removed')
  }

  async function handleSendInvoice(submissionId: string) {
    await markDealtWith(submissionId)
    setSubmissions((previous) =>
      previous.map((submission) => (submission.id === submissionId ? { ...submission, dealt_with: true } : submission)),
    )
  }

  return (
    <div className="app-shell">
      <PortalHeader portalLabel="Owner portal" userName={profile.full_name} onSignOut={signOut} />

      {loading ? (
        <p className="info-text">Loading dashboard…</p>
      ) : loadError ? (
        <p className="message message-error">{loadError}</p>
      ) : (
        <>
          <section className="stat-grid">
            <StatCard label="Active workers" value={String(activeWorkers)} hint={`${pendingInvites} pending invite${pendingInvites === 1 ? '' : 's'}`} />
            <StatCard label="Pending submissions" value={String(pendingSubmissions)} hint="awaiting invoice" />
            <StatCard label="Paid out this month" value={formatCurrency(totalThisMonth)} />
            <StatCard label="Team size" value={String(workers.length)} hint="all-time" />
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Weekly totals</h2>
                <p>Submitted amounts across your whole team, most recent weeks.</p>
              </div>
            </div>
            {trendData.length === 0 ? (
              <p className="info-text">No submissions yet.</p>
            ) : (
              <WeekTrendChart data={trendData} />
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Team</h2>
                <p>Onboard workers and manage access.</p>
              </div>
            </div>

            <form className="add-worker-form" onSubmit={handleAddWorker}>
              <label>
                Full name
                <input value={newWorkerName} onChange={(event) => setNewWorkerName(event.target.value)} placeholder="Jordan Lee" />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={newWorkerEmail}
                  onChange={(event) => setNewWorkerEmail(event.target.value)}
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
                  onChange={(event) => setNewWorkerShare(event.target.value)}
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
                              onChange={(event) => setShareDraft(event.target.value)}
                              autoFocus
                            />
                            <button type="button" className="link-btn" onClick={() => handleSaveShare(worker.id)}>
                              Save
                            </button>
                            <button type="button" className="link-btn" onClick={() => setEditingShareId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="share-value" onClick={() => startEditShare(worker)}>
                            {worker.owner_share_percent}%
                          </button>
                        )}
                      </td>
                      <td>
                        <ProfileStatusBadge status={worker.status} />
                      </td>
                      <td className="roster-actions">
                        {worker.status === 'active' && (
                          <button type="button" className="btn-outline" onClick={() => handleStatusChange(worker.id, 'suspended')}>
                            Suspend
                          </button>
                        )}
                        {worker.status === 'suspended' && (
                          <button type="button" className="btn-outline" onClick={() => handleStatusChange(worker.id, 'active')}>
                            Reactivate
                          </button>
                        )}
                        {worker.status !== 'removed' && (
                          <button type="button" className="btn-danger" onClick={() => handleRemove(worker)}>
                            Remove
                          </button>
                        )}
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
                <h2>Submissions</h2>
                <p>Select a worker to review their weekly timesheets and mark invoices.</p>
              </div>
            </div>

            <div className="worker-cards">
              {workers
                .filter((worker) => worker.status !== 'removed')
                .map((worker) => {
                  const workerTotal = submissions
                    .filter((submission) => submission.worker_id === worker.id)
                    .reduce((sum, submission) => sum + submission.amount, 0)
                  const workerPending = submissions.filter(
                    (submission) => submission.worker_id === worker.id && !submission.dealt_with,
                  ).length

                  return (
                    <article
                      key={worker.id}
                      className={`worker-card ${worker.id === selectedWorkerId ? 'selected' : ''}`}
                      onClick={() => setSelectedWorkerId(worker.id)}
                    >
                      <strong>{worker.full_name}</strong>
                      <p>Total submitted: {formatCurrency(workerTotal)}</p>
                      <p>{workerPending} pending submission{workerPending === 1 ? '' : 's'}</p>
                    </article>
                  )
                })}
            </div>

            {selectedWorker ? (
              <div className="stack">
                <div className="table-header">
                  <h3>{selectedWorker.full_name}</h3>
                  <p>Click a row to see daily amounts and create an invoice.</p>
                </div>
                <div className="table-wrapper">
                  <table className="submission-table">
                    <thead>
                      <tr>
                        <th>Week</th>
                        <th>Total</th>
                        <th>Owner share</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWorkerSubmissions.map((submission) => (
                        <tr key={submission.id} className="submission-row" onClick={() => setSelectedSubmissionId(submission.id)}>
                          <td>{formatWeekRange(submission.week_start, submission.week_end)}</td>
                          <td>{formatCurrency(submission.amount)}</td>
                          <td>{formatCurrency(submission.amount * (submission.owner_share_percent / 100))}</td>
                          <td>
                            <SubmissionStatusBadge dealtWith={submission.dealt_with} />
                          </td>
                        </tr>
                      ))}
                      {selectedWorkerSubmissions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="empty-row">
                            No submissions yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="info-text">Select a worker card to view their weekly submissions.</p>
            )}
          </section>
        </>
      )}

      {selectedSubmission && selectedWorker && (
        <SubmissionInvoiceModal
          submission={selectedSubmission}
          workerName={selectedWorker.full_name}
          workerEmail={selectedWorker.email}
          onClose={() => setSelectedSubmissionId(null)}
          onSendInvoice={handleSendInvoice}
        />
      )}
    </div>
  )
}
