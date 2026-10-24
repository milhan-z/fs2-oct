import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { BigLights } from '../../components/ChristmasLights'
import { CAM_BUILDING, LOUNGE_BOUNDS, WALLS_INNER, cameraTransform, pinLabel, pinPath, viewBoxOf, type Rect } from '../../map/geometry'
import { EASE_OUT } from '../../motion/presets'
import { ONBOARDED_KEY } from './Photo'

// a) lights  b) silhouette  c) plan draws  d) zoom to Lounge  e) pins drop  f) card
const TIMELINE = [0, 1100, 2100, 3700, 4700, 5500]

const LOUNGE_CAM: Rect = { x: LOUNGE_BOUNDS.x - 120, y: LOUNGE_BOUNDS.y - 160, w: LOUNGE_BOUNDS.w + 240, h: LOUNGE_BOUNDS.h + 420 }

/** Onboarding map story (MOTION #2) — skippable, replayable from Panduan. */
export function Onboarding() {
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
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
      const c = animate(cam, 1, { duration: reduce ? 0 : 1.0, ease: EASE_OUT })
      return () => c.stop()
    }
  }, [phase, cam, reduce])

  const apply = (t: number) => {
    const lerp = (a: number, b: number) => a + (b - a) * t
    const target: Rect = {
      x: lerp(CAM_BUILDING.x, LOUNGE_CAM.x),
      y: lerp(CAM_BUILDING.y, LOUNGE_CAM.y),
      w: lerp(CAM_BUILDING.w, LOUNGE_CAM.w),
      h: lerp(CAM_BUILDING.h, LOUNGE_CAM.h),
    }
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
    localStorage.setItem(ONBOARDED_KEY, '1')
    nav('/map', { replace: true })
  }

  const booths = content?.booths ?? []
  const rooms = content?.rooms.filter((r) => !r.batas) ?? []
  const L = LOUNGE_BOUNDS
  const drawn = phase >= 2

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <style>{`
        .ob-draw rect, .ob-draw path { stroke-dasharray: 1; stroke-dashoffset: 1; }
        .ob-draw.on rect, .ob-draw.on path { animation: ob-draw 1.1s cubic-bezier(.22,1,.36,1) forwards; animation-delay: calc(var(--i) * 45ms); }
        .ob-draw rect[fill="currentColor"]:not([fill-opacity]) { opacity: 0; }
        .ob-draw.on rect[fill="currentColor"]:not([fill-opacity]) { animation: ob-fade .6s ease forwards; animation-delay: calc(var(--i) * 45ms); }
        @keyframes ob-draw { to { stroke-dashoffset: 0; } }
        @keyframes ob-fade { to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .ob-draw rect, .ob-draw path { stroke-dasharray: none; opacity: 1 !important; } }
      `}</style>

      <button type="button" onClick={finish} className="absolute top-4 right-4 z-20 min-h-11 rounded-full border border-white/25 bg-black/40 px-4 text-[14px] font-semibold text-cream">
        Skip
      </button>

      {/* a) lights */}
      <BigLights lit={4} sequence={!reduce} className="relative z-10 mx-auto mt-4 w-[78%] max-w-[300px]" />

      {/* red fog */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(70% 45% at 50% 75%, rgba(120,20,24,0.55) 0%, rgba(40,8,10,0.2) 50%, transparent 80%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 1 ? 1 : 0 }}
        transition={{ duration: 1.2 }}
      />

      {/* b) building silhouette rising */}
      <motion.div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[46%] w-[58%] -translate-x-1/2"
        initial={{ y: '100%' }}
        animate={{ y: phase >= 1 ? '0%' : '100%', opacity: phase >= 2 ? 0 : 1 }}
        transition={{ duration: phase >= 2 ? 0.8 : 1.0, ease: EASE_OUT }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" preserveAspectRatio="none" className="h-full w-full">
          <path d="M20 200 V70 H70 V40 H130 V70 H180 V200 Z" fill="#1e0a0d" />
          <rect x="72" y="36" width="56" height="5" fill="#f4e8e2" opacity="0.9" />
          {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={36 + c * 36} y={92 + r * 32} width="12" height="14" fill="#F9B018" opacity={(r + c) % 3 === 0 ? 0.55 : 0.12} />))}
        </svg>
      </motion.div>

      {/* pine forest + smoke from the GSM kit */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex items-end justify-between px-1"
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: phase >= 1 ? 0 : 120, opacity: phase >= 1 ? (phase >= 3 ? 0.35 : 0.9) : 0 }}
        transition={{ duration: 1.1, ease: EASE_OUT }}
        aria-hidden="true"
      >
        {[70, 110, 88, 130, 76, 120, 92].map((h, i) => (
          <img key={i} src="/assets/gsm/pine.webp" alt="" className="w-auto opacity-90 brightness-[0.45]" style={{ height: h }} />
        ))}
      </motion.div>
      {[
        { src: '/assets/gsm/smoke1.svg', className: 'left-[6%] w-[22%]', delay: 0.4 },
        { src: '/assets/gsm/smoke2.svg', className: 'right-[4%] w-[26%]', delay: 0.9 },
      ].map((s) => (
        <motion.img
          key={s.src}
          src={s.src}
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-[8%] z-[1] ${s.className}`}
          initial={{ y: 80, opacity: 0 }}
          animate={phase >= 1 && phase < 4 ? { y: -40, opacity: 0.18 } : { y: -120, opacity: 0 }}
          transition={{ duration: 2.4, delay: s.delay, ease: 'easeOut' }}
        />
      ))}

      {/* c–e) plan */}
      <motion.div className="relative z-[5] mx-auto -mt-2 w-full flex-1" initial={{ opacity: 0 }} animate={{ opacity: drawn ? 1 : 0 }} transition={{ duration: 0.4 }}>
        <svg viewBox={viewBoxOf(CAM_BUILDING)} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" role="img" aria-label="Global Kampong floor plan: all booths are in the Lounge">
          <g ref={camRef}>
            <g className={`ob-draw text-cream ${drawn ? 'on' : ''}`} style={{ opacity: 0.6 }} dangerouslySetInnerHTML={{ __html: walls }} />
            {rooms.map((r, i) => (
              <motion.text key={r.label} x={r.x} y={r.y} textAnchor="middle" fontFamily="Poppins" fontWeight="800" fontSize="120" fill="#F4E8E2" initial={{ opacity: 0 }} animate={{ opacity: drawn && phase < 3 ? 0.85 : 0 }} transition={{ delay: drawn && phase < 3 ? 0.8 + i * 0.15 : 0 }}>
                {r.label}
              </motion.text>
            ))}
            {/* d) lounge highlight + vines */}
            <motion.rect x={L.x + 20} y={L.y + 16} width={L.w - 40} height={L.h - 32} rx="24" fill="#F9B018" fillOpacity="0.1" stroke="#F9B018" strokeWidth="10" strokeDasharray="36 24" initial={{ opacity: 0 }} animate={{ opacity: phase >= 3 ? 1 : 0 }} transition={{ duration: 0.6, delay: 0.4 }} />
            {[
              `M${L.x} ${L.y + 200} q-60 120 10 260 q60 110 -20 240 q-50 90 20 200`,
              `M${L.x + L.w} ${L.y + 900} q70 120 -10 260 q-60 110 20 240`,
              `M${L.x + 100} ${L.y} q120 -70 240 10 q100 60 200 -20`,
            ].map((d, i) => (
              <motion.path key={i} d={d} fill="none" stroke="#c4181f" strokeWidth="16" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: phase >= 3 ? 1 : 0 }} transition={{ duration: 1.1, delay: 0.5 + i * 0.15 }} />
            ))}
            <motion.text x={L.x + L.w / 2} y={L.y + L.h - 150} textAnchor="middle" fontFamily="Anton" fontSize="120" letterSpacing="10" fill="#F9B018" initial={{ opacity: 0 }} animate={{ opacity: phase >= 3 ? 1 : 0 }} transition={{ delay: 0.6 }}>
              LOUNGE
            </motion.text>
            {/* e) pins */}
            {phase >= 4 &&
              booths.map((b, i) => (
                <motion.g key={b.id} initial={{ y: -1200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 28, delay: i * 0.12 }}>
                  <ellipse cx={b.x} cy={b.y + 92} rx="40" ry="11" fill="#000" opacity="0.45" />
                  <path d={pinPath(b.x, b.y)} fill={['#43A047', '#D22B26', '#3B5BDB', '#F9B018'][i % 4]} stroke="#F4E8E2" strokeWidth="8" />
                  <text x={b.x} y={b.y - 32} textAnchor="middle" fontFamily="Anton" fontSize={pinLabel(b.nama, b.sort).length > 6 ? 34 : 40} fill="#fff">
                    {pinLabel(b.nama, b.sort)}
                  </text>
                </motion.g>
              ))}
          </g>
        </svg>
      </motion.div>

      {/* f) card */}
      <AnimatePresence>
        {phase >= 5 && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45, ease: EASE_OUT }} className="absolute inset-x-0 bottom-0 z-10 m-4 rounded-[20px] border border-[#5a2a2c] bg-[#1a0a0c]/95 p-5 shadow-2xl">
            <p className="kicker text-[12px]">Floor plan</p>
            <p className="mt-1 text-[18px] leading-snug font-extrabold text-white">All booths are in the Lounge</p>
            <p className="mt-1 text-[14px] text-muted">Enter through the Front Office — the Lounge is right ahead. Visit all 4 booths, in any order.</p>
            <button type="button" onClick={finish} className="btn btn-red mt-4 w-full">
              Start
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
