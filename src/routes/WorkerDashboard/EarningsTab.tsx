import { DayEntryModal } from '../../components/DayEntryModal'
import { HoverEffectGrid } from '../../components/HoverEffect/HoverEffectGrid'
import { HoverEffectItem } from '../../components/HoverEffect/HoverEffectItem'
import { Modal } from '../../components/Modal'
import { SubmissionStatusBadge } from '../../components/StatusBadge'
import { daysOfWeek, formatCurrency, formatWeekRange } from '../../lib/dates'
import { sectionLabel, type ClientEarningsTotal, type ClientSectionBreakdownRow } from '../../lib/earnings'
import type { Client, SaleEntry, SaleType, Submission } from '../../types'

function WeekPanel({
  title,
  subtitle,
  weekDates,
  totalsByDate,
  clientTotals,
  liveTotal,
  totalLabel,
  onDayClick,
  submitLabel,
  onSubmit,
  submitting,
  showSubmit,
  formError,
  message,
}: {
  title: string
  subtitle: string
  weekDates: string[]
  totalsByDate: Map<string, number>
  clientTotals: ClientEarningsTotal[]
  liveTotal: number
  totalLabel: string
  onDayClick: (date: string) => void
  submitLabel: string
  onSubmit: () => void
  submitting: boolean
  showSubmit: boolean
  formError: string | null
  message: string | null
}) {
  return (
    <section className="panel worker-panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="stack">
        <HoverEffectGrid className="day-grid">
          {daysOfWeek.map((day, index) => {
            const date = weekDates[index]
            return (
              <HoverEffectItem key={day} index={index}>
                <button type="button" className="day-card day-card-clickable" onClick={() => onDayClick(date)}>
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
          <strong>{totalLabel}</strong>
          <p className="summary-figure">{formatCurrency(liveTotal)}</p>
        </div>

        {showSubmit && (
          <button type="button" className="btn-primary" onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : submitLabel}
          </button>
        )}
        {formError && <p className="message message-error">{formError}</p>}
        {message && <p className="message message-info">{message}</p>}
      </div>
    </section>
  )
}

export function EarningsTab({
  weekStart,
  weekEnd,
  weekDates,
  totalsByDate,
  clientTotals,
  liveTotal,
  alreadySubmittedThisWeek,
  onSubmit,
  onDayClick,

  showLastWeekPanel,
  previousWeek,
  previousWeekDates,
  previousTotalsByDate,
  previousClientTotals,
  previousLiveTotal,
  graceDeadlineLabel,
  onSubmitLastWeek,

  submitting,
  formError,
  message,

  submissions,
  loadingSubmissions,
  loadError,
  lifetimeTotal,
  onSelectSubmission,

  selectedSubmission,
  selectedSubmissionClientTotals,
  selectedSubmissionBreakdown,
  onCloseSubmissionModal,

  selectedDate,
  workerId,
  clients,
  saleTypes,
  selectedDayLabel,
  selectedDayEntries,
  selectedDayReadOnly,
  onEntryAdded,
  onEntryDeleted,
  onCloseDayModal,
}: {
  weekStart: string
  weekEnd: string
  weekDates: string[]
  totalsByDate: Map<string, number>
  clientTotals: ClientEarningsTotal[]
  liveTotal: number
  alreadySubmittedThisWeek: boolean
  onSubmit: () => void
  onDayClick: (date: string) => void

  showLastWeekPanel: boolean
  previousWeek: { weekStart: string; weekEnd: string }
  previousWeekDates: string[]
  previousTotalsByDate: Map<string, number>
  previousClientTotals: ClientEarningsTotal[]
  previousLiveTotal: number
  graceDeadlineLabel: string
  onSubmitLastWeek: () => void

  submitting: boolean
  formError: string | null
  message: string | null

  submissions: Submission[]
  loadingSubmissions: boolean
  loadError: string | null
  lifetimeTotal: number
  onSelectSubmission: (id: string) => void

  selectedSubmission: Submission | null
  selectedSubmissionClientTotals: ClientEarningsTotal[]
  selectedSubmissionBreakdown: ClientSectionBreakdownRow[]
  onCloseSubmissionModal: () => void

  selectedDate: string | null
  workerId: string
  clients: Client[]
  saleTypes: SaleType[]
  selectedDayLabel: string
  selectedDayEntries: SaleEntry[]
  selectedDayReadOnly: boolean
  onEntryAdded: (entry: SaleEntry) => void
  onEntryDeleted: (entryId: string) => void
  onCloseDayModal: () => void
}) {
  return (
    <>
      {alreadySubmittedThisWeek && (
        <p className="info-text">
          You've already submitted this week's timesheet. You can still open a day below to review its entries.
        </p>
      )}

      <WeekPanel
        title="This week"
        subtitle={formatWeekRange(weekStart, weekEnd)}
        weekDates={weekDates}
        totalsByDate={totalsByDate}
        clientTotals={clientTotals}
        liveTotal={liveTotal}
        totalLabel="Current week total"
        onDayClick={onDayClick}
        submitLabel="Submit earnings"
        onSubmit={onSubmit}
        submitting={submitting}
        showSubmit={!alreadySubmittedThisWeek}
        formError={formError}
        message={message}
      />

      {showLastWeekPanel && (
        <WeekPanel
          title="Last week"
          subtitle={`${formatWeekRange(previousWeek.weekStart, previousWeek.weekEnd)} — add sales until ${graceDeadlineLabel}`}
          weekDates={previousWeekDates}
          totalsByDate={previousTotalsByDate}
          clientTotals={previousClientTotals}
          liveTotal={previousLiveTotal}
          totalLabel="Last week total"
          onDayClick={onDayClick}
          submitLabel="Submit last week's earnings"
          onSubmit={onSubmitLastWeek}
          submitting={submitting}
          showSubmit
          formError={formError}
          message={message}
        />
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
                  <tr key={submission.id} className="submission-row" onClick={() => onSelectSubmission(submission.id)}>
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
        <Modal title="Timesheet detail" onClose={onCloseSubmissionModal}>
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

      {selectedDate && (
        <DayEntryModal
          date={selectedDate}
          dayLabel={selectedDayLabel}
          workerId={workerId}
          clients={clients}
          saleTypes={saleTypes}
          entries={selectedDayEntries}
          readOnly={selectedDayReadOnly}
          onEntryAdded={onEntryAdded}
          onEntryDeleted={onEntryDeleted}
          onClose={onCloseDayModal}
        />
      )}
    </>
  )
}
