export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="progress-cell">
      <div className="progress-cell-track">
        <div className="progress-cell-fill" style={{ width: `${clamped}%` }} />
      </div>
      <span>{clamped}%</span>
    </div>
  )
}
