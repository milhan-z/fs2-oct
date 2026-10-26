import { motion, useReducedMotion } from 'motion/react'
import { haptic } from '../app/sound'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParticipant } from '../app/participant'

/** Per-passport tour state: 'pending' (show it) → 'done'. */
export const tourKey = (participantId: string) => `fs2.tour.${participantId}`
export function startTour(participantId: string) {
  localStorage.setItem(tourKey(participantId), 'pending')
}

const STEPS = [
  { sel: '[data-tour="next"]', title: 'Next up', body: 'Always shows where to go next. Tap it and it opens that booth for you.' },
  { sel: '[data-tour="pin"]', title: 'Booth pins', body: 'Tap a pin to meet the speaker and see your visa status for that booth.' },
  { sel: '[data-tour="tab-qr"]', title: 'Your QR permit', body: 'Show it to the booth officer. They scan it and your passport gets stamped, within seconds.' },
  { sel: '[data-tour="tab-passport"]', title: 'Your passport', body: 'Your visas, your notes for each booth and, at the end, feedback and Submit.' },
] as const

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/**
 * First-run tour of the buttons: a spotlight moves from "Next up" to the pins, the QR tab and the Passport tab,
 * each with a one-line explanation. Shown once per passport after the map intro; replayable from the Guide.
 */
export function CoachTour() {
  const reduce = useReducedMotion()
  const { state } = useParticipant()
  const pid = state?.participant.id
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)

  // opens by itself once the map has unfolded
  useEffect(() => {
    if (!pid || localStorage.getItem(tourKey(pid)) !== 'pending') return
    const t = window.setTimeout(() => setOpen(true), reduce ? 300 : 1900)
    return () => clearTimeout(t)
  }, [pid, reduce])

  const close = () => {
    if (pid) localStorage.setItem(tourKey(pid), 'done')
    setOpen(false)
  }
  const next = () => {
    haptic.tick()
    if (i >= STEPS.length - 1) close()
    else setI(i + 1)
  }

  // follow the target of the current step (it may still be animating in, or the window may resize)
  useEffect(() => {
    if (!open) return
    let tries = 0
    let timer = 0
    const measure = () => {
      const el = document.querySelector(STEPS[i].sel)
      if (el) {
        const r = el.getBoundingClientRect()
        setBox({ x: r.left, y: r.top, w: r.width, h: r.height })
      } else if (tries++ < 16) timer = window.setTimeout(measure, 150)
      else if (i < STEPS.length - 1) setI(i + 1)
      else close()
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open || !box) return null
  const step = STEPS[i]
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.min(330, vw - 24)
  const left = Math.max(12, Math.min(vw - 12 - cardW, box.x + box.w / 2 - cardW / 2))
  const above = box.y + box.h / 2 > vh * 0.5
  const pad = 8

  return createPortal(
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="App tour">
      {/* the scrim and the spotlight hole are one element: a huge shadow around the target */}
      <motion.div
        className="pointer-events-none fixed rounded-[14px]"
        initial={false}
        animate={{ left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
        style={{ boxShadow: '0 0 0 9999px rgba(10,6,8,.82), 0 0 0 3px rgba(255,217,211,.95), 0 0 26px rgba(224,48,42,.85)' }}
      />
      <div className="absolute inset-0" onClick={next} aria-hidden="true" />
      <motion.div
        key={i}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: above ? 10 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: reduce ? 0 : 0.12 }}
        className="mat-paper absolute p-4 shadow-[var(--shadow-lift)]"
        style={{ left, width: cardW, ...(above ? { bottom: vh - box.y + pad + 14 } : { top: box.y + box.h + pad + 14 }) }}
      >
        <p className="font-mono text-[12px] tracking-[0.12em] text-ink/60 uppercase">
          Tour · {i + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 font-serif text-[22px] leading-tight font-bold">{step.title}</h2>
        <p className="mt-1.5 text-[15px] leading-[22px] text-ink/85">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="min-h-11 px-1 text-[14px] text-ink/65 underline underline-offset-4">
            Skip tour
          </button>
          <button type="button" onClick={next} autoFocus className="btn btn-primary min-h-11 px-6">
            {i === STEPS.length - 1 ? 'Got it' : 'Next'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
