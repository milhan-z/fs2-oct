import type { Transition, Variants } from 'motion/react'

export const EASE_OUT = [0.22, 1, 0.36, 1] as const

export const springPhysical: Transition = { type: 'spring', stiffness: 500, damping: 28 }
export const springSheet: Transition = { type: 'spring', stiffness: 380, damping: 36 }

/** MOTION #11 — generic screen change: 24px horizontal slide + fade, 250ms */
export const screenVariants: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: EASE_OUT } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.18, ease: EASE_OUT } },
}
