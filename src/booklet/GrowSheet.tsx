import { motion, useAnimate, usePresence, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { takeOrigin } from './pages'

/**
 * A paper sheet laid over the current page. It grows out of the element that opened it (the
 * remembered origin rect) and shrinks back into it when closed; without an origin it rises from
 * the bottom. Used for the visa page and the exit form.
 */
export function GrowSheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  const [scope, animate] = useAnimate()
  const [isPresent, safeToRemove] = usePresence()
  const from = useRef<{ x: number; y: number; scale: number } | null>(null)

  useLayoutEffect(() => {
    const el = scope.current as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    const o = takeOrigin()
    from.current = o
      ? { x: o.left + o.width / 2 - (r.left + r.width / 2), y: o.top + o.height / 2 - (r.top + r.height / 2), scale: Math.max(0.12, o.width / r.width) }
      : { x: 0, y: r.height * 0.9, scale: 1 }
    if (reduce) animate(el, { opacity: [0, 1] }, { duration: 0.12 })
    else animate(el, { x: [from.current.x, 0], y: [from.current.y, 0], scale: [from.current.scale, 1], opacity: [0.35, 1] }, { type: 'spring', stiffness: 300, damping: 32 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    if (isPresent) return
    const el = scope.current as HTMLElement | null
    const f = from.current
    if (!el || !f || reduce) {
      safeToRemove?.()
      return
    }
    animate(el, { x: f.x, y: f.y, scale: f.scale, opacity: 0 }, { duration: 0.28, ease: [0.4, 0, 0.6, 1] }).then(() => safeToRemove?.())
  }, [isPresent, animate, scope, reduce, safeToRemove])

  return (
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label={label}>
      <motion.div className="absolute inset-0 bg-night-0/80" initial={{ opacity: 0 }} animate={{ opacity: isPresent ? 1 : 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
      <div ref={scope} className="mat-paper absolute inset-x-2 top-3 bottom-2 overflow-hidden rounded-[3px] shadow-[var(--shadow-lift)]" style={{ boxShadow: 'var(--shadow-lift), var(--shadow-page-edge)' }}>
        <div className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}
