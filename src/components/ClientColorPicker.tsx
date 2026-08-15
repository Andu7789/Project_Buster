import { useEffect, useRef, useState } from 'react'
import { CLIENT_COLOR_PALETTE } from '../lib/clientColor'

export function ClientColorPicker({ value, onChange, label }: { value: string; onChange: (color: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="color-picker" ref={containerRef}>
      <button
        type="button"
        className="color-swatch-trigger"
        style={{ background: value }}
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        aria-expanded={open}
      />
      {open && (
        <div className="color-swatch-grid">
          {CLIENT_COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-swatch ${color === value ? 'selected' : ''}`}
              style={{ background: color }}
              onClick={() => {
                onChange(color)
                setOpen(false)
              }}
              aria-label={color}
            />
          ))}
        </div>
      )}
    </div>
  )
}
