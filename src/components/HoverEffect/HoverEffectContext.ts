import { createContext, useContext } from 'react'

export interface HoverEffectContextValue {
  hoveredIndex: number | null
  setHoveredIndex: (index: number | null) => void
  layoutId: string
}

export const HoverEffectContext = createContext<HoverEffectContextValue | null>(null)

export function useHoverEffectContext(): HoverEffectContextValue {
  const context = useContext(HoverEffectContext)
  if (!context) throw new Error('HoverEffectItem must be used within a HoverEffectGrid')
  return context
}
