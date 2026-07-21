export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'danger'
}) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className={`stat-value ${tone === 'danger' ? 'stat-value-danger' : ''}`}>{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}
