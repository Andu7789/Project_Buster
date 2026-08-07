import type { FormEvent } from 'react'
import { ProfileStatusBadge } from '../../components/StatusBadge'
import { TRAINING_MODULE_COUNT, TRAINING_MODULE_TITLES } from '../../lib/trainingContent'
import type { Profile, ProfileStatus, TrainingProgress } from '../../types'

export function LearnersTrainingTab({
  learners,
  newLearnerName,
  newLearnerEmail,
  addingLearner,
  addLearnerError,
  addLearnerMessage,
  learnerRosterError,
  onNewLearnerNameChange,
  onNewLearnerEmailChange,
  onAddLearner,
  onLearnerStatusChange,
  onRemoveLearner,
  onDeleteLearner,
  progressByLearner,
}: {
  learners: Profile[]
  newLearnerName: string
  newLearnerEmail: string
  addingLearner: boolean
  addLearnerError: string | null
  addLearnerMessage: string | null
  learnerRosterError: string | null
  onNewLearnerNameChange: (value: string) => void
  onNewLearnerEmailChange: (value: string) => void
  onAddLearner: (event: FormEvent) => void
  onLearnerStatusChange: (learnerId: string, status: ProfileStatus) => void
  onRemoveLearner: (learner: Profile) => void
  onDeleteLearner: (learner: Profile) => void
  progressByLearner: Map<string, TrainingProgress[]>
}) {
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Learners</h2>
            <p>Give someone access to the training portal.</p>
          </div>
        </div>

        <form className="add-worker-form" onSubmit={onAddLearner}>
          <label>
            Full name
            <input value={newLearnerName} onChange={(event) => onNewLearnerNameChange(event.target.value)} placeholder="Jordan Lee" />
          </label>
          <label>
            Email
            <input
              type="email"
              value={newLearnerEmail}
              onChange={(event) => onNewLearnerEmailChange(event.target.value)}
              placeholder="jordan@example.com"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={addingLearner}>
            {addingLearner ? 'Adding…' : 'Add learner'}
          </button>
        </form>
        {addLearnerError && <p className="message message-error">{addLearnerError}</p>}
        {addLearnerMessage && <p className="message message-info">{addLearnerMessage}</p>}

        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((learner) => (
                <tr key={learner.id}>
                  <td>{learner.full_name}</td>
                  <td>{learner.email}</td>
                  <td>
                    <ProfileStatusBadge status={learner.status} />
                  </td>
                  <td>
                    <div className="roster-actions">
                      {learner.status === 'active' && (
                        <button type="button" className="btn-outline" onClick={() => onLearnerStatusChange(learner.id, 'suspended')}>
                          Suspend
                        </button>
                      )}
                      {learner.status === 'suspended' && (
                        <button type="button" className="btn-outline" onClick={() => onLearnerStatusChange(learner.id, 'active')}>
                          Reactivate
                        </button>
                      )}
                      {learner.status !== 'removed' && (
                        <button type="button" className="btn-danger" onClick={() => onRemoveLearner(learner)}>
                          Remove
                        </button>
                      )}
                      {learner.status === 'removed' && (
                        <button type="button" className="btn-danger" onClick={() => onDeleteLearner(learner)}>
                          Delete permanently
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {learners.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No learners yet — add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {learnerRosterError && <p className="message message-error">{learnerRosterError}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Training progress</h2>
            <p>How far each learner has gotten through the onboarding track.</p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Progress</th>
                <th>Modules completed</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {learners
                .filter((learner) => learner.status !== 'removed')
                .map((learner) => {
                  const rows = progressByLearner.get(learner.id) ?? []
                  const pct = Math.round((rows.length / TRAINING_MODULE_COUNT) * 100)
                  const lastActivity = rows
                    .map((row) => row.completed_at)
                    .sort()
                    .at(-1)
                  return (
                    <tr key={learner.id}>
                      <td>{learner.full_name}</td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-cell-track">
                            <div className="progress-cell-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span>{pct}%</span>
                        </div>
                      </td>
                      <td>
                        {rows.length === 0
                          ? '—'
                          : `${rows.length}/${TRAINING_MODULE_COUNT} — ${rows
                              .map((row) => TRAINING_MODULE_TITLES[row.module_id] ?? row.module_id)
                              .join(', ')}`}
                      </td>
                      <td>{lastActivity ? new Date(lastActivity).toLocaleDateString('en-GB') : 'Not started'}</td>
                    </tr>
                  )
                })}
              {learners.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No learners yet.
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
