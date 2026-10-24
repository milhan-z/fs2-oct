import { motion, useReducedMotion } from 'motion/react'

export const BULB_COLORS = ['#E53935', '#F6C343', '#43A047', '#3B5BDB', '#3A9AAE', '#EC6FA5']

/** Irregular "Joyce Byers" flicker keyframes ending lit. */
const FLICKER = [0, 1, 0.15, 0.9, 0.3, 1, 0.6, 1]

interface BigProps {
  /** how many bulbs are lit (from the left) */
  lit: number
  count?: number
  /** turn bulbs on one by one with flicker on mount */
  sequence?: boolean
  /** index of a bulb that just turned on — flickers 3× */
  justLit?: number | null
  /** all lit bulbs blink together once */
  celebrate?: boolean
  className?: string
}

/** Big bulbs on a wire — cover, stamp moment, status. Each bulb animates on its own. */
export function BigLights({ lit, count = 4, sequence = false, justLit = null, celebrate = false, className = '' }: BigProps) {
  const reduce = useReducedMotion()
  const w = 320
  const xs = Array.from({ length: count }, (_, i) => 52 + i * ((w - 104) / Math.max(1, count - 1)))
  const wireY = (x: number) => 24 + 14 * Math.sin((x / w) * Math.PI * 1.6 + 0.4)
  return (
    <svg viewBox={`0 0 ${w} 86`} className={className} aria-hidden="true">
      <path d={`M0 ${wireY(0)} ${Array.from({ length: 33 }, (_, i) => `L${i * 10} ${wireY(i * 10)}`).join(' ')}`} fill="none" stroke="#3a3436" strokeWidth="2.5" />
      {xs.map((x, i) => {
        const y = wireY(x) + 6
        const on = i < lit
        const color = BULB_COLORS[i % BULB_COLORS.length]
        const animateOn = !reduce && on && (sequence || justLit === i || celebrate)
        const delay = sequence ? 0.25 + i * 0.32 + (i % 2) * 0.08 : 0
        const keyframes = celebrate ? [1, 0.2, 1] : justLit === i ? [0, 1, 0.1, 1, 0.2, 1] : FLICKER
        return (
          <g key={i}>
            <rect x={x - 3} y={y - 4} width="6" height="8" rx="1" fill="#4a4446" />
            {on ? (
              <motion.g
                initial={animateOn ? { opacity: 0 } : false}
                animate={{ opacity: animateOn ? keyframes : 1 }}
                transition={{ duration: celebrate ? 0.6 : 0.9, delay, times: undefined }}
              >
                <circle cx={x} cy={y + 24} r="31" fill={color} opacity="0.22" />
                <ellipse cx={x} cy={y + 24} rx="13" ry="19" fill={color} />
                <ellipse cx={x - 4} cy={y + 17} rx="3.5" ry="6" fill="#fff" opacity="0.35" />
              </motion.g>
            ) : (
              <ellipse cx={x} cy={y + 24} rx="13" ry="19" fill={color} fillOpacity="0.16" stroke={color} strokeOpacity="0.4" strokeWidth="2" />
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Small droplet bulbs along a sagging wire — map panel & booth sheet. */
export function StringLights({ className = '', count = 7 }: { className?: string; count?: number }) {
  const reduce = useReducedMotion()
  return (
    <svg viewBox="0 0 354 60" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M-4 10 Q 88 40 177 18 T 358 12" fill="none" stroke="#1a0a0c" strokeWidth="2" />
      {Array.from({ length: count }, (_, i) => {
        const x = 24 + i * (310 / (count - 1))
        const y = 17 + 14 * Math.sin((i / (count - 1)) * Math.PI * 1.1)
        return (
          <motion.path
            key={i}
            d={`M${x} ${y} q-5 8 0 15 q5 -7 0 -15z`}
            fill={BULB_COLORS[i % BULB_COLORS.length]}
            animate={reduce ? undefined : { opacity: [1, 0.55, 1] }}
            transition={{ duration: 2.4 + (i % 3) * 0.7, repeat: Infinity, delay: i * 0.37 }}
          />
        )
      })}
    </svg>
  )
}

/** 4 progress lights in the participant header (MOTION #7). */
export function ProgressLights({ lit, count = 4, justLit = null, celebrate = false }: { lit: number; count?: number; justLit?: number | null; celebrate?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <div className="flex gap-1.5" role="img" aria-label={`${lit} of ${count} booths stamped`}>
      {Array.from({ length: count }, (_, i) => {
        const c = BULB_COLORS[i % BULB_COLORS.length]
        const on = i < lit
        const anim = !reduce && on && (justLit === i || celebrate)
        return (
          <motion.span
            key={i}
            className="block h-[19px] w-[13px] rounded-[50%_50%_45%_45%]"
            style={on ? { background: c, boxShadow: `0 0 8px ${c}` } : { background: `${c}2e`, boxShadow: `inset 0 0 0 1.5px ${c}66` }}
            initial={false}
            animate={anim ? { opacity: celebrate ? [1, 0.2, 1] : [0.2, 1, 0.2, 1, 0.2, 1] } : { opacity: 1 }}
            transition={{ duration: 0.6 }}
          />
        )
      })}
    </div>
  )
}
