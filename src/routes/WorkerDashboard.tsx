import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/authContext'
import {
  listClients,
  listSaleEntriesForWorker,
  listSaleTypes,
  listSubmissionsForWorker,
  submitTimesheet,
} from '../data/queries'
import {
  daysOfWeek,
  formatCurrency,
  formatDayLabel,
  formatWeekRange,
  getCurrentWeekRange,
  getPreviousWeekRange,
  getWeekDates,
  isWithinGracePeriod,
} from '../lib/dates'
import { breakdownByClientAndSection, earningsByClient, sectionLabel } from '../lib/earnings'
import type { Client, Profile, SaleEntry, SaleType, Submission } from '../types'
import { PortalHeader } from '../components/PortalHeader'
import { SubmissionStatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'
import { DayEntryModal } from '../components/DayEntryModal'
import { HoverEffectGrid } from '../components/HoverEffect/HoverEffectGrid'
import { HoverEffectItem } from '../components/HoverEffect/HoverEffectItem'

export function WorkerDashboard({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [saleTypes, setSaleTypes] = useState<SaleType[]>([])
  const [weekEntries, setWeekEntries] = useState<SaleEntry[]>([])
  const [previousWeekEntries, setPreviousWeekEntries] = useState<SaleEntry[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [selectedSubmissionEntries, setSelectedSubmissionEntries] = useState<SaleEntry[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { weekStart, weekEnd } = useMemo(() => getCurrentWeekRange(), [])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const previousWeek = useMemo(() => getPreviousWeekRange(weekStart), [weekStart])
  const previousWeekDates = useMemo(() => getWeekDates(previousWeek.weekStart), [previousWeek.weekStart])
  const graceActive = useMemo(() => isWithinGracePeriod(), [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listSubmissionsForWorker(profile.id),
      listClients(),
      listSaleTypes(),
      listSaleEntriesForWorker(profile.id, weekStart, weekEnd),
      graceActive
        ? listSaleEntriesForWorker(profile.id, previousWeek.weekStart, previousWeek.weekEnd)
        : Promise.resolve([]),
    ])
      .then(([submissionData, clientData, saleTypeData, entryData, previousEntryData]) => {
        if (cancelled) return
        setSubmissions(submissionData)
        setClients(clientData)
        setSaleTypes(saleTypeData)
        setWeekEntries(entryData)
        setPreviousWeekEntries(previousEntryData)
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
  }, [profile.id, weekStart, weekEnd, graceActive, previousWeek.weekStart, previousWeek.weekEnd])

  const alreadySubmittedThisWeek = submissions.some((submission) => submission.week_start === weekStart)
  const alreadySubmittedLastWeek = submissions.some((submission) => submission.week_start === previousWeek.weekStart)
  const showLastWeekPanel = graceActive && !alreadySubmittedLastWeek
  const lifetimeTotal = useMemo(() => submissions.reduce((sum, submission) => sum + submission.amount, 0), [submissions])

  const totalsByDate = useMemo(() => {
    const totals = new Map<string, number>()
    for (const entry of weekEntries) {
      totals.set(entry.entry_date, (totals.get(entry.entry_date) ?? 0) + entry.earnings)
    }
    return totals
  }, [weekEntries])

  const previousTotalsByDate = useMemo(() => {
    const totals = new Map<string, number>()
    for (const entry of previousWeekEntries) {
      totals.set(entry.entry_date, (totals.get(entry.entry_date) ?? 0) + entry.earnings)
    }
    return totals
  }, [previousWeekEntries])

  const liveTotal = useMemo(() => weekEntries.reduce((sum, entry) => sum + entry.earnings, 0), [weekEntries])
  const previousLiveTotal = useMemo(
    () => previousWeekEntries.reduce((sum, entry) => sum + entry.earnings, 0),
    [previousWeekEntries],
  )

  const clientTotals = useMemo(() => earningsByClient(weekEntries, clients), [weekEntries, clients])
  const previousClientTotals = useMemo(
    () => earningsByClient(previousWeekEntries, clients),
    [previousWeekEntries, clients],
  )

  const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId) ?? null

  useEffect(() => {
    if (!selectedSubmission) return
    let cancelled = false
    listSaleEntriesForWorker(profile.id, selectedSubmission.week_start, selectedSubmission.week_end)
      .then((data) => {
        if (!cancelled) setSelectedSubmissionEntries(data)
      })
      .catch(() => {
        if (!cancelled) setSelectedSubmissionEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedSubmission, profile.id])

  const selectedSubmissionClientTotals = useMemo(
    () => earningsByClient(selectedSubmissionEntries, clients),
    [selectedSubmissionEntries, clients],
  )
  const selectedSubmissionBreakdown = useMemo(
    () => breakdownByClientAndSection(selectedSubmissionEntries, clients),
    [selectedSubmissionEntries, clients],
  )

  const selectedIsPreviousWeek = selectedDate !== null && previousWeekDates.includes(selectedDate)
  const selectedWeekDates = selectedIsPreviousWeek ? previousWeekDates : weekDates
  const selectedDayIndex = selectedDate ? selectedWeekDates.indexOf(selectedDate) : -1
  const selectedDayEntries = selectedDate
    ? [...weekEntries, ...previousWeekEntries].filter((entry) => entry.entry_date === selectedDate)
    : []
  const selectedDayReadOnly = selectedIsPreviousWeek ? alreadySubmittedLastWeek : alreadySubmittedThisWeek

  function handleEntryAdded(entry: SaleEntry) {
    if (previousWeekDates.includes(entry.entry_date)) {
      setPreviousWeekEntries((previous) => [...previous, entry])
    } else {
      setWeekEntries((previous) => [...previous, entry])
    }
  }

  function handleEntryDeleted(entryId: string) {
    setWeekEntries((previous) => previous.filter((entry) => entry.id !== entryId))
    setPreviousWeekEntries((previous) => previous.filter((entry) => entry.id !== entryId))
  }

  async function submitWeek(params: {
    weekStart: string
    weekEnd: string
    weekDates: string[]
    totalsByDate: Map<string, number>
  }) {
    setFormError(null)
    setMessage(null)

    const dayAmounts: Record<string, number> = {}
    daysOfWeek.forEach((day, index) => {
      const total = params.totalsByDate.get(params.weekDates[index]) ?? 0
      if (total > 0) dayAmounts[day] = total
    })

    const total = Object.values(dayAmounts).reduce((sum, value) => sum + value, 0)
    if (!total) {
      setFormError('Add at least one entry before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const created = await submitTimesheet({
        workerId: profile.id,
        weekStart: params.weekStart,
        weekEnd: params.weekEnd,
        dayAmounts,
        amount: total,
        ownerSharePercent: profile.owner_share_percent,
      })
      setSubmissions((previous) => [created, ...previous])
      setMessage('Weekly submission sent to your employer.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit your timesheet.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = () => submitWeek({ weekStart, weekEnd, weekDates, totalsByDate })
  const handleSubmitLastWeek = () =>
    submitWeek({
      weekStart: previousWeek.weekStart,
      weekEnd: previousWeek.weekEnd,
      weekDates: previousWeekDates,
      totalsByDate: previousTotalsByDate,
    })

  const graceDeadlineLabel = useMemo(
    () => new Date(weekDates[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    [weekDates],
  )

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

        {alreadySubmittedThisWeek && (
          <p className="info-text">
            You've already submitted this week's timesheet. You can still open a day below to review its entries.
          </p>
        )}

        <div className="stack">
          <HoverEffectGrid className="day-grid">
            {daysOfWeek.map((day, index) => {
              const date = weekDates[index]
              return (
                <HoverEffectItem key={day} index={index}>
                  <button
                    type="button"
                    className="day-card day-card-clickable"
                    onClick={() => setSelectedDate(date)}
                  >
                    <span>{day}</span>
                    <strong>{formatCurrency(totalsByDate.get(date) ?? 0)}</strong>
                  </button>
                </HoverEffectItem>
              )
            })}
          </HoverEffectGrid>

          <div className="table-wrapper">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Total earnings</th>
                </tr>
              </thead>
              <tbody>
                {clientTotals.map((row) => (
                  <tr key={row.clientName}>
                    <td>{row.clientName}</td>
                    <td>{formatCurrency(row.earnings)}</td>
                  </tr>
                ))}
                {clientTotals.length === 0 && (
                  <tr>
                    <td colSpan={2} className="empty-row">
                      No entries logged yet this week.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="summary-card">
            <strong>Current week total</strong>
            <p className="summary-figure">{formatCurrency(liveTotal)}</p>
          </div>

          {!alreadySubmittedThisWeek && (
            <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit earnings'}
            </button>
          )}
          {formError && <p className="message message-error">{formError}</p>}
          {message && <p className="message message-info">{message}</p>}
        </div>
      </section>

      {showLastWeekPanel && (
        <section className="panel worker-panel">
          <div className="panel-head">
            <div>
              <h2>Last week</h2>
              <p>
                {formatWeekRange(previousWeek.weekStart, previousWeek.weekEnd)} — add sales until {graceDeadlineLabel}
              </p>
            </div>
          </div>

          <div className="stack">
            <HoverEffectGrid className="day-grid">
              {daysOfWeek.map((day, index) => {
                const date = previousWeekDates[index]
                return (
                  <HoverEffectItem key={day} index={index}>
                    <button
                      type="button"
                      className="day-card day-card-clickable"
                      onClick={() => setSelectedDate(date)}
                    >
                      <span>{day}</span>
                      <strong>{formatCurrency(previousTotalsByDate.get(date) ?? 0)}</strong>
                    </button>
                  </HoverEffectItem>
                )
              })}
            </HoverEffectGrid>

            <div className="table-wrapper">
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Total earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {previousClientTotals.map((row) => (
                    <tr key={row.clientName}>
                      <td>{row.clientName}</td>
                      <td>{formatCurrency(row.earnings)}</td>
                    </tr>
                  ))}
                  {previousClientTotals.length === 0 && (
                    <tr>
                      <td colSpan={2} className="empty-row">
                        No entries logged for last week.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="summary-card">
              <strong>Last week total</strong>
              <p className="summary-figure">{formatCurrency(previousLiveTotal)}</p>
            </div>

            <button type="button" className="btn-primary" onClick={handleSubmitLastWeek} disabled={submitting}>
              {submitting ? 'Submitting…' : "Submit last week's earnings"}
            </button>
            {formError && <p className="message message-error">{formError}</p>}
            {message && <p className="message message-info">{message}</p>}
          </div>
        </section>
      )}

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

          <h3>Earnings by client</h3>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Total earnings</th>
              </tr>
            </thead>
            <tbody>
              {selectedSubmissionClientTotals.map((row) => (
                <tr key={row.clientName}>
                  <td>{row.clientName}</td>
                  <td>{formatCurrency(row.earnings)}</td>
                </tr>
              ))}
              {selectedSubmissionClientTotals.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty-row">
                    No line items recorded for this week.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h3>Full breakdown</h3>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Section</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Earnings</th>
              </tr>
            </thead>
            <tbody>
              {selectedSubmissionBreakdown.map((row) => (
                <tr key={`${row.clientName}:${row.section}`}>
                  <td>{row.clientName}</td>
                  <td>{sectionLabel[row.section]}</td>
                  <td>{formatCurrency(row.gross)}</td>
                  <td>{formatCurrency(row.net)}</td>
                  <td>{formatCurrency(row.earnings)}</td>
                </tr>
              ))}
              {selectedSubmissionBreakdown.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No line items recorded for this week.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {selectedSubmission.notes && (
            <div className="submission-notes">
              <p className="label">Your note</p>
              <p>{selectedSubmission.notes}</p>
            </div>
          )}
        </Modal>
      )}

      {selectedDate && selectedDayIndex !== -1 && (
        <DayEntryModal
          date={selectedDate}
          dayLabel={formatDayLabel(daysOfWeek[selectedDayIndex], selectedDate)}
          workerId={profile.id}
          clients={clients}
          saleTypes={saleTypes}
          entries={selectedDayEntries}
          readOnly={selectedDayReadOnly}
          onEntryAdded={handleEntryAdded}
          onEntryDeleted={handleEntryDeleted}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
