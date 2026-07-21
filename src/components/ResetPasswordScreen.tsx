import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/authContext'

export function ResetPasswordScreen() {
  const { completePasswordReset } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setSubmitting(true)
    const { error: resetError } = await completePasswordReset(password)
    setSubmitting(false)

    if (resetError) {
      setError(resetError)
      return
    }
    setDone(true)
  }

  return (
    <div className="app-shell app-shell-center">
      <section className="panel login-panel">
        <div className="brand-block">
          <div className="logo-mark">PS</div>
          <h2>Set a new password</h2>
          <p>Choose a new password for your account.</p>
        </div>

        {done ? (
          <p className="message message-info">Password updated. Continuing…</p>
        ) : (
          <form className="stack" onSubmit={handleSubmit}>
            <label>
              New password
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Re-enter your new password"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save new password'}
            </button>
            {error && <p className="message message-error">{error}</p>}
          </form>
        )}
      </section>
    </div>
  )
}
