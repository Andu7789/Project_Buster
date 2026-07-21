import { useEffect, type ReactNode } from 'react'

export function PortalHeader({
  portalLabel,
  userName,
  onSignOut,
  rightSlot,
}: {
  portalLabel: string
  userName?: string
  onSignOut?: () => void
  rightSlot?: ReactNode
}) {
  useEffect(() => {
    document.title = `${portalLabel} — PS Management Services`
  }, [portalLabel])

  return (
    <header className="portal-header">
      <div className="portal-header-inner">
        <div className="portal-brand">
          <div className="logo-mark">PS</div>
          <div>
            <strong>PS Management Services</strong>
            <span className="portal-badge">{portalLabel}</span>
          </div>
        </div>
        <div className="portal-header-right">
          {rightSlot}
          {userName && <span className="portal-user">{userName}</span>}
          {onSignOut && (
            <button type="button" className="btn-ghost" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
