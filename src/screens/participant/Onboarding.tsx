import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { LightString } from '../../components/ChristmasLights'
import { CAM_BUILDING, LOUNGE_BOUNDS, WALLS_INNER, cameraTransform, viewBoxOf, type Rect } from '../../map/geometry'
import { boothCode, TicketPaper } from '../../booklet/print'
import { useParticipant } from '../../app/participant'
import { startTour } from '../../booklet/CoachTour'
import { onboardedKey } from './Photo'

// a) lights  b) silhouette  c) plan draws  d) zoom to Lounge  e) pins drop  f) note
const TIMELINE = [0, 1100, 2100, 3700, 4700, 5500]
const EASE = [0.22, 1, 0.36, 1] as const

const LOUNGE_CAM: Rect = { x: LOUNGE_BOUNDS.x - 120, y: LOUNGE_BOUNDS.y - 160, w: LOUNGE_BOUNDS.w + 240, h: LOUNGE_BOUNDS.h + 420 }

/** Onboarding map story (MOTION #2) — a Night moment outside the book; skippable and replayable. */
export function Onboarding() {
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state } = useParticipant()
  const [phase, setPhase] = useState(reduce ? 5 : 0)
  const cam = useMotionValue(0)
  const camRef = useRef<SVGGElement>(null)

  useEffect(() => {
    if (reduce) return
    const timers = TIMELINE.map((ms, i) => setTimeout(() => setPhase((p) => Math.max(p, i)), ms))
    return () => timers.forEach(clearTimeout)
  }, [reduce])

  useEffect(() => {
    if (phase >= 3) {
      const c = animate(cam, 1, { duration: reduce ? 0 : 1.0, ease: EASE })
      return () => c.stop()
    }
  }, [phase, cam, reduce])

  const apply = (t: number) => {
    const lerp = (a: number, b: number) => a + (b - a) * t
    const target: Rect = { x: lerp(CAM_BUILDING.x, LOUNGE_CAM.x), y: lerp(CAM_BUILDING.y, LOUNGE_CAM.y), w: lerp(CAM_BUILDING.w, LOUNGE_CAM.w), h: lerp(CAM_BUILDING.h, LOUNGE_CAM.h) }
    camRef.current?.setAttribute('transform', cameraTransform(CAM_BUILDING, target).str)
  }
  useMotionValueEvent(cam, 'change', apply)
  useEffect(() => {
    apply(cam.get())
  })

  // walls with a per-element stagger index for the line-by-line draw
  const walls = useMemo(() => {
    let i = 0
    return WALLS_INNER.replace(/<(rect|path) /g, (_m, tag) => `<${tag} style="--i:${i++}" `)
  }, [])

  const finish = () => {
    if (state) {
      const first = !localStorage.getItem(onboardedKey(state.participant.id))
      localStorage.setItem(onboardedKey(state.participant.id), '1')
      if (first) startTour(state.participant.id) // the button tour follows the intro, once per passport
    }
    nav('/map', { replace: true })
  }

  const booths = content ? [...content.booths].sort((a, b) => a.sort - b.sort) : []
  const rooms = content?.rooms.filter((r) => !r.batas) ?? []
  const L = LOUNGE_BOUNDS
  const drawn = phase >= 2

  return (
    <main className="mat-night relative flex h-dvh flex-col overflow-hidden">
      <style>{`
        .ob-draw * { vector-effect: non-scaling-stroke; }
        .ob-draw rect, .ob-draw path { stroke-width: 1.4px; stroke-dasharray: 1; stroke-dashoffset: 1; }
        .ob-draw rect[fill="currentColor"]:not([fill-opacity]) { fill: none; stroke: currentColor; }
        .ob-draw.on rect, .ob-draw.on path { animation: ob-draw 1.1s cubic-bezier(.22,1,.36,1) forwards; animation-delay: calc(var(--i) * 45ms); }
        @keyframes ob-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .ob-draw rect, .ob-draw path { stroke-dasharray: none; } }
      `}</style>

      {/* one red light source from a crack below */}
      <div className="pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-[50%] bg-[#8f1d17] opacity-30 blur-3xl" aria-hidden="true" />

      <button type="button" onClick={finish} className="absolute top-3 right-3 z-20 min-h-11 px-3 text-[14px] text-cream/85 underline decoration-cream/30 underline-offset-4">
        Skip
      </button>

      {/* a) lights */}
      <div className="relative z-10 mx-6 mt-1 h-[42px]">
        <LightString lit="all" count={content ? Math.min(content.rules.jumlah_booth_wajib, content.booths.length) : 4} sequence={!reduce} className="h-full w-full" />
      </div>

      {/* b) building silhouette rising, pines in front */}
      <motion.div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[42%] w-[56%] -translate-x-1/2"
        initial={{ y: '100%' }}
        animate={{ y: phase >= 1 ? '0%' : '100%', opacity: phase >= 2 ? 0 : 1 }}
        transition={{ duration: phase >= 2 ? 0.8 : 1.0, ease: EASE }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" preserveAspectRatio="none" className="h-full w-full">
          <path d="M20 200 V70 H70 V40 H130 V70 H180 V200 Z" fill="#241012" />
          {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={36 + c * 36} y={92 + r * 32} width="12" height="14" fill="#F9B018" opacity={(r + c) % 3 === 0 ? 0.5 : 0.1} />))}
        </svg>
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex items-end justify-between px-1"
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: phase >= 1 ? 0 : 120, opacity: phase >= 1 ? (phase >= 3 ? 0.35 : 0.9) : 0 }}
        transition={{ duration: 1.1, ease: EASE }}
        aria-hidden="true"
      >
        {[70, 110, 88, 130, 76, 120, 92].map((h, i) => (
          <img key={i} src="/assets/gsm/pine.webp" alt="" className="w-auto brightness-[0.4]" style={{ height: h }} />
        ))}
      </motion.div>

      {/* c–e) plan */}
      <motion.div className="relative z-[5] w-full flex-1" initial={{ opacity: 0 }} animate={{ opacity: drawn ? 1 : 0 }} transition={{ duration: 0.4 }}>
        <svg viewBox={viewBoxOf(CAM_BUILDING)} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" role="img" aria-label="Global Kampong floor plan: all booths are in the Lounge">
          <g ref={camRef}>
            <g className={`ob-draw text-cream ${drawn ? 'on' : ''}`} style={{ opacity: 0.7 }} dangerouslySetInnerHTML={{ __html: walls }} />
            {rooms.map((r, i) => (
              <motion.text key={r.label} x={r.x} y={r.y} textAnchor="middle" fontFamily="Poppins" fontWeight="600" fontSize="110" fill="#F4E8E2" initial={{ opacity: 0 }} animate={{ opacity: drawn && phase < 3 ? 0.75 : 0 }} transition={{ delay: drawn && phase < 3 ? 0.8 + i * 0.15 : 0 }}>
                {r.label}
              </motion.text>
            ))}
            {/* d) lounge highlight draws itself */}
            <motion.rect
              x={L.x + 20}
              y={L.y + 16}
              width={L.w - 40}
              height={L.h - 32}
              rx="8"
              fill="#F9B018"
              fillOpacity="0.06"
              stroke="#F9B018"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="8 6"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 3 ? 1 : 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            />
            <motion.text x={L.x + L.w / 2} y={L.y + L.h - 150} textAnchor="middle" fontFamily="Libre Baskerville" fontWeight="700" fontSize="110" letterSpacing="12" fill="#F9B018" initial={{ opacity: 0 }} animate={{ opacity: phase >= 3 ? 1 : 0 }} transition={{ delay: 0.6 }}>
              LOUNGE
            </motion.text>
            {/* e) pins — same ink-mark language as the map, all "not stamped yet" */}
            {phase >= 4 &&
              booths.map((b, i) => (
                <motion.g key={b.id} initial={{ y: -900, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 28, delay: i * 0.12 }}>
                  <ellipse cx={b.x + 8} cy={b.y + 82} rx="58" ry="12" fill="#000" opacity="0.4" />
                  <circle cx={b.x} cy={b.y} r="74" fill="#120a0b" fillOpacity="0.6" stroke="#e05a50" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                  <circle cx={b.x} cy={b.y} r="60" fill="none" stroke="#e05a50" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                  <text x={b.x} y={b.y + 30} textAnchor="middle" fontFamily="Anton" fontSize="78" fill="#f3ebdd">
                    {boothCode(b.nama, b.sort)}
                  </text>
                </motion.g>
              ))}
          </g>
        </svg>
      </motion.div>

      {/* f) note */}
      <AnimatePresence>
        {phase >= 5 && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45, ease: EASE }} className="absolute inset-x-4 bottom-4 z-10">
            <TicketPaper className="px-5 pt-6 pb-5">
              <p className="font-mono text-[11px] tracking-[0.12em] text-ink/60 uppercase">Floor plan</p>
              <p className="mt-1 font-serif text-[22px] leading-tight font-bold text-ink">All booths are in the Lounge</p>
              <p className="mt-2 text-[15px] leading-[22px] text-ink/75">Enter through the Front Office — the Lounge is right ahead. Collect all 4 visas, in any order.</p>
              <motion.button type="button" onClick={finish} whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} className="btn btn-primary mt-5 w-full">
                Start
              </motion.button>
            </TicketPaper>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
