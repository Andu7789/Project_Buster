import { SubmissionStatusBadge } from '../../components/StatusBadge'
import { formatCurrency, formatWeekRange } from '../../lib/dates'
import type { Profile, Submission } from '../../types'

function workerName(workers: Profile[], workerId: string): string {
  return workers.find((worker) => worker.id === workerId)?.full_name ?? 'Unknown worker'
}

function PendingInvoiceRow({
  submission,
  workers,
  onDownload,
  onMarkPaid,
}: {
  submission: Submission
  workers: Profile[]
  onDownload: (submission: Submission) => void
  onMarkPaid: (submissionId: string) => void
}) {
  return (
    <tr>
      <td>{workerName(workers, submission.worker_id)}</td>
      <td>{formatWeekRange(submission.week_start, submission.week_end)}</td>
      <td>{formatCurrency(submission.amount)}</td>
      <td>
        <SubmissionStatusBadge dealtWith={submission.dealt_with} />
      </td>
      <td>
        <div className="roster-actions">
          <button type="button" className="btn-outline" onClick={() => onDownload(submission)}>
            Download
          </button>
          <button type="button" className="btn-primary" onClick={() => onMarkPaid(submission.id)}>
            Mark as paid
          </button>
        </div>
      </td>
    </tr>
  )
}

export function InvoicesTab({
  submissions,
  workers,
  weekStart,
  weekEnd,
  isCurrentWeek,
  onPreviousWeek,
  onNextWeek,
  onJumpToCurrentWeek,
  onDownloadInvoice,
  onMarkPaid,
}: {
  submissions: Submission[]
  workers: Profile[]
  weekStart: string
  weekEnd: string
  isCurrentWeek: boolean
  onPreviousWeek: () => void
  onNextWeek: () => void
  onJumpToCurrentWeek: () => void
  onDownloadInvoice: (submission: Submission) => void
  onMarkPaid: (submissionId: string) => void
}) {
  const weekSubmissions = submissions.filter((submission) => submission.week_start === weekStart)
  const pending = weekSubmissions.filter((submission) => !submission.paid)
  const paid = weekSubmissions.filter((submission) => submission.paid)

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Pending payment</h2>
            <p>
              {isCurrentWeek
                ? "This week's worker invoices. Mark one paid once you've sent the money."
                : `${formatWeekRange(weekStart, weekEnd)}'s worker invoices. Mark one paid once you've sent the money.`}
            </p>
          </div>
          <div className="roster-actions">
            <button type="button" className="btn-outline" onClick={onPreviousWeek}>
              ← Previous week
            </button>
            {!isCurrentWeek && (
              <button type="button" className="btn-outline" onClick={onJumpToCurrentWeek}>
                Current week
              </button>
            )}
            <button type="button" className="btn-outline" onClick={onNextWeek} disabled={isCurrentWeek}>
              Next week →
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Week</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((submission) => (
                <PendingInvoiceRow
                  key={submission.id}
                  submission={submission}
                  workers={workers}
                  onDownload={onDownloadInvoice}
                  onMarkPaid={onMarkPaid}
                />
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No unpaid invoices for this week.
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
            <h2>Paid invoices</h2>
            <p>
              {isCurrentWeek
                ? "Invoices you've already paid out this week."
                : `Invoices you've already paid out for ${formatWeekRange(weekStart, weekEnd)}.`}
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Week</th>
                <th>Total</th>
                <th>Paid on</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paid.map((submission) => (
                <tr key={submission.id}>
                  <td>{workerName(workers, submission.worker_id)}</td>
                  <td>{formatWeekRange(submission.week_start, submission.week_end)}</td>
                  <td>{formatCurrency(submission.amount)}</td>
                  <td>{submission.paid_at ? new Date(submission.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td>
                    <button type="button" className="btn-outline" onClick={() => onDownloadInvoice(submission)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
              {paid.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No paid invoices for this week yet.
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
