import type { FormEvent } from 'react'
import { ProfileStatusBadge } from '../../components/StatusBadge'
import type { Profile, ProfileStatus } from '../../types'

export function AccountTab({
  currentProfileId,
  owners,
  newOwnerName,
  newOwnerEmail,
  addingOwner,
  addOwnerError,
  addOwnerMessage,
  ownerRosterError,
  onNewOwnerNameChange,
  onNewOwnerEmailChange,
  onAddOwner,
  onOwnerStatusChange,
  onRemoveOwner,
  onDeleteOwner,
  newPassword,
  confirmPassword,
  changingPassword,
  passwordError,
  passwordMessage,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onChangePassword,
}: {
  currentProfileId: string
  owners: Profile[]
  newOwnerName: string
  newOwnerEmail: string
  addingOwner: boolean
  addOwnerError: string | null
  addOwnerMessage: string | null
  ownerRosterError: string | null
  onNewOwnerNameChange: (value: string) => void
  onNewOwnerEmailChange: (value: string) => void
  onAddOwner: (event: FormEvent) => void
  onOwnerStatusChange: (ownerId: string, status: ProfileStatus) => void
  onRemoveOwner: (owner: Profile) => void
  onDeleteOwner: (owner: Profile) => void
  newPassword: string
  confirmPassword: string
  changingPassword: boolean
  passwordError: string | null
  passwordMessage: string | null
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onChangePassword: (event: FormEvent) => void
}) {
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Owners</h2>
            <p>Everyone with owner-level access to this dashboard.</p>
          </div>
        </div>

        <form className="add-worker-form" onSubmit={onAddOwner}>
          <label>
            Full name
            <input value={newOwnerName} onChange={(event) => onNewOwnerNameChange(event.target.value)} placeholder="Jordan Lee" />
          </label>
          <label>
            Email
            <input
              type="email"
              value={newOwnerEmail}
              onChange={(event) => onNewOwnerEmailChange(event.target.value)}
              placeholder="jordan@example.com"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={addingOwner}>
            {addingOwner ? 'Adding…' : 'Add owner'}
          </button>
        </form>
        {addOwnerError && <p className="message message-error">{addOwnerError}</p>}
        {addOwnerMessage && <p className="message message-info">{addOwnerMessage}</p>}

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
              {owners.map((owner) => {
                const isSelf = owner.id === currentProfileId
                return (
                  <tr key={owner.id}>
                    <td>
                      {owner.full_name}
                      {isSelf && <span className="info-text"> (you)</span>}
                    </td>
                    <td>{owner.email}</td>
                    <td>
                      <ProfileStatusBadge status={owner.status} />
                    </td>
                    <td>
                      <div className="roster-actions">
                        {!isSelf && owner.status === 'active' && (
                          <button type="button" className="btn-outline" onClick={() => onOwnerStatusChange(owner.id, 'suspended')}>
                            Suspend
                          </button>
                        )}
                        {!isSelf && owner.status === 'suspended' && (
                          <button type="button" className="btn-outline" onClick={() => onOwnerStatusChange(owner.id, 'active')}>
                            Reactivate
                          </button>
                        )}
                        {!isSelf && owner.status !== 'removed' && (
                          <button type="button" className="btn-danger" onClick={() => onRemoveOwner(owner)}>
                            Remove
                          </button>
                        )}
                        {!isSelf && owner.status === 'removed' && (
                          <button type="button" className="btn-danger" onClick={() => onDeleteOwner(owner)}>
                            Delete permanently
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {owners.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No owners yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {ownerRosterError && <p className="message message-error">{ownerRosterError}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Change your password</h2>
            <p>Updates the password for your own login.</p>
          </div>
        </div>

        <form className="add-worker-form" onSubmit={onChangePassword}>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => onNewPasswordChange(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={changingPassword}>
            {changingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
        {passwordError && <p className="message message-error">{passwordError}</p>}
        {passwordMessage && <p className="message message-info">{passwordMessage}</p>}
      </section>
    </>
  )
}
