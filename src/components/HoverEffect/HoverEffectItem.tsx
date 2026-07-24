import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useHoverEffectContext } from './HoverEffectContext'

export function HoverEffectItem({ index, children }: { index: number; children: ReactNode }) {
  const { hoveredIndex, setHoveredIndex, layoutId } = useHoverEffectContext()
  const reduceMotion = useReducedMotion()
  const isHovered = hoveredIndex === index

  return (
    <div
      className="hover-effect-item"
      onMouseEnter={() => setHoveredIndex(index)}
      onFocus={() => setHoveredIndex(index)}
      onBlur={() => setHoveredIndex(null)}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.span
            className="hover-effect-highlight"
            layoutId={reduceMotion ? undefined : `hover-highlight-${layoutId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.2, duration: 0.5 }}
          />
        )}
      </AnimatePresence>
      <div className="hover-effect-content">{children}</div>
    </div>
  )
}
