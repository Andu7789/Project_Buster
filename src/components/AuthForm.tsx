import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/authContext'

type Mode = 'signin' | 'signup' | 'forgot'

export function AuthForm({
  portalLabel,
}: {
  portalLabel: string
}) {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    if (mode === 'forgot') {
      const { error: resetError } = await requestPasswordReset(email)
      setSubmitting(false)
      if (resetError) {
        setError(resetError)
        return
      }
      setInfo('Check your email for a password reset link.')
      return
    }

    const action = mode === 'signin' ? signIn : signUp
    const { error: authError } = await action(email, password)

    setSubmitting(false)

    if (authError) {
      setError(authError)
      return
    }

    if (mode === 'signup') {
      setInfo('Account created. If email confirmation is required, check your inbox before signing in.')
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  return (
    <section className="panel login-panel">
      <div className="brand-block">
        <div className="logo-mark">PS</div>
        <h2>{portalLabel}</h2>
        <p>
          {mode === 'signup' && 'Create your login using the email your employer added.'}
          {mode === 'forgot' && "Enter your email and we'll send you a reset link."}
        </p>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        {mode !== 'forgot' && (
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting
            ? 'Please wait…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : 'Send reset link'}
        </button>
        {error && <p className="message message-error">{error}</p>}
        {info && <p className="message message-info">{info}</p>}
      </form>

      <div className="auth-switch">
        {mode === 'signin' && (
          <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>
            Forgot password?
          </button>
        )}
        {mode === 'forgot' ? (
          <button type="button" className="link-btn" onClick={() => switchMode('signin')}>
            Back to sign in
          </button>
        ) : (
          <button type="button" className="link-btn" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
        )}
      </div>
    </section>
  )
}
