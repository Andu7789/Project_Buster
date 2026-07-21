import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/authContext'

export function AuthForm({
  portalLabel,
  portalHint,
  otherPortalPath,
  otherPortalPrompt,
}: {
  portalLabel: string
  portalHint: string
  otherPortalPath: string
  otherPortalPrompt: string
}) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
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

  function toggleMode() {
    setMode((current) => (current === 'signin' ? 'signup' : 'signin'))
    setError(null)
    setInfo(null)
  }

  return (
    <section className="panel login-panel">
      <div className="brand-block">
        <div className="logo-mark">PS</div>
        <h2>{portalLabel}</h2>
        <p>{mode === 'signin' ? portalHint : 'Create your login using the email your employer added.'}</p>
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
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        {error && <p className="message message-error">{error}</p>}
        {info && <p className="message message-info">{info}</p>}
      </form>

      <div className="auth-switch">
        <button type="button" className="link-btn" onClick={toggleMode}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
        <a className="link-btn" href={otherPortalPath}>
          {otherPortalPrompt}
        </a>
      </div>
    </section>
  )
}
