import type { ReactNode } from 'react'

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
  return (
    <header className="portal-header">
      <div className="portal-brand">
        <div className="logo-mark">PS</div>
        <div>
          <strong>PS Management Services</strong>
          <span className="portal-label">{portalLabel}</span>
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
    </header>
  )
}
