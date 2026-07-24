import { useId, useState, type ReactNode } from 'react'
import { HoverEffectContext } from './HoverEffectContext'

export function HoverEffectGrid({ className, children }: { className?: string; children: ReactNode }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const layoutId = useId()

  return (
    <HoverEffectContext.Provider value={{ hoveredIndex, setHoveredIndex, layoutId }}>
      <div className={className} onMouseLeave={() => setHoveredIndex(null)}>
        {children}
      </div>
    </HoverEffectContext.Provider>
  )
}
