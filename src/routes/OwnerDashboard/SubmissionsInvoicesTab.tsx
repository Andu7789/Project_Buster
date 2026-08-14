import { HoverEffectGrid } from '../../components/HoverEffect/HoverEffectGrid'
import { HoverEffectItem } from '../../components/HoverEffect/HoverEffectItem'
import { SubmissionStatusBadge } from '../../components/StatusBadge'
import { formatCurrency, formatWeekRange } from '../../lib/dates'
import { clientPayoutTotal } from '../../lib/earnings'
import type { Client, ClientInvoice, Profile, SaleEntry, Submission } from '../../types'

export function SubmissionsInvoicesTab({
  workers,
  submissions,
  selectedWorkerId,
  selectedWorker,
  selectedWorkerSubmissions,
  onSelectWorker,
  onSelectSubmission,
  activeClients,
  clients,
  weekEntries,
  clientInvoices,
  currentWeekStart,
  selectedClientId,
  onSelectClient,
  onViewInvoice,
}: {
  workers: Profile[]
  submissions: Submission[]
  selectedWorkerId: string | null
  selectedWorker: Profile | null
  selectedWorkerSubmissions: Submission[]
  onSelectWorker: (workerId: string) => void
  onSelectSubmission: (submissionId: string) => void
  activeClients: Client[]
  clients: Client[]
  weekEntries: SaleEntry[]
  clientInvoices: ClientInvoice[]
  currentWeekStart: string
  selectedClientId: string | null
  onSelectClient: (clientId: string) => void
  onViewInvoice: (invoiceId: string) => void
}) {
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Submissions</h2>
            <p>Select a worker to review their weekly timesheets and mark invoices.</p>
          </div>
        </div>

        <HoverEffectGrid className="worker-cards">
          {workers
            .filter((worker) => worker.status !== 'removed')
            .map((worker, index) => {
              const workerTotal = submissions
                .filter((submission) => submission.worker_id === worker.id)
                .reduce((sum, submission) => sum + submission.amount, 0)
              const workerPending = submissions.filter(
                (submission) => submission.worker_id === worker.id && !submission.dealt_with,
              ).length

              return (
                <HoverEffectItem key={worker.id} index={index}>
                  <article
                    className={`worker-card ${worker.id === selectedWorkerId ? 'selected' : ''}`}
                    onClick={() => onSelectWorker(worker.id)}
                  >
                    <strong>{worker.full_name}</strong>
                    <p>Total submitted: {formatCurrency(workerTotal)}</p>
                    <p className={workerPending > 0 ? 'text-danger' : undefined}>
                      {workerPending} pending submission{workerPending === 1 ? '' : 's'}
                    </p>
                  </article>
                </HoverEffectItem>
              )
            })}
        </HoverEffectGrid>

        {selectedWorker ? (
          <div className="stack">
            <div className="table-header">
              <h3>{selectedWorker.full_name}</h3>
              <p>Click a row to see daily amounts and agree the submission.</p>
            </div>
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
                  {selectedWorkerSubmissions.map((submission) => (
                    <tr key={submission.id} className="submission-row" onClick={() => onSelectSubmission(submission.id)}>
                      <td>{formatWeekRange(submission.week_start, submission.week_end)}</td>
                      <td>{formatCurrency(submission.amount)}</td>
                      <td>
                        <SubmissionStatusBadge dealtWith={submission.dealt_with} />
                      </td>
                    </tr>
                  ))}
                  {selectedWorkerSubmissions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="empty-row">
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

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Client invoices</h2>
            <p>This week's sales per client — check the figures and confirm.</p>
          </div>
        </div>

        <HoverEffectGrid className="worker-cards">
          {activeClients.map((client, index) => {
            const entries = weekEntries.filter((entry) => entry.client_id === client.id)
            const invoice = clientInvoices.find(
              (inv) => inv.client_id === client.id && inv.week_start === currentWeekStart,
            )
            return (
              <HoverEffectItem key={client.id} index={index}>
                <article
                  className={`worker-card client-color-card entry-client-${index % 5} ${client.id === selectedClientId ? 'selected' : ''}`}
                  onClick={() => onSelectClient(client.id)}
                >
                  <strong>{client.name}</strong>
                  <p>Client payout: {formatCurrency(clientPayoutTotal(entries, client))}</p>
                  <p className={!invoice ? 'info-text' : invoice.dealt_with ? undefined : 'text-danger'}>
                    {!invoice ? 'No invoice yet' : invoice.dealt_with ? 'Confirmed' : 'Not yet checked'}
                  </p>
                </article>
              </HoverEffectItem>
            )
          })}
        </HoverEffectGrid>
        {activeClients.length === 0 && <p className="info-text">No active clients yet.</p>}

        <div className="table-header">
          <h3>Invoice history</h3>
          <p>Click a row to review the full breakdown behind that week's figures.</p>
        </div>
        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Week</th>
                <th>Client payout</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clientInvoices.map((invoice) => (
                <tr key={invoice.id} className="submission-row" onClick={() => onViewInvoice(invoice.id)}>
                  <td>{clients.find((c) => c.id === invoice.client_id)?.name ?? 'Unknown client'}</td>
                  <td>{formatWeekRange(invoice.week_start, invoice.week_end)}</td>
                  <td>{formatCurrency(invoice.client_payout)}</td>
                  <td>
                    <SubmissionStatusBadge dealtWith={invoice.dealt_with} />
                  </td>
                </tr>
              ))}
              {clientInvoices.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No client invoices yet.
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
