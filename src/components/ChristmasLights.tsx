import { motion, useReducedMotion } from 'motion/react'

export const BULB_COLORS = ['#E53935', '#F6C343', '#43A047', '#3B5BDB', '#3A9AAE', '#EC6FA5']

/** Irregular "Joyce Byers" flicker keyframes ending lit. */
const FLICKER = [0, 1, 0.15, 0.9, 0.3, 1, 0.6, 1]

interface Props {
  /** how many bulbs are lit (from the left); 'all' = decorative */
  lit: number | 'all'
  count?: number
  /** turn bulbs on one by one with flicker on mount (cover, onboarding) */
  sequence?: boolean
  /** index of a bulb that just turned on — flickers, then stays */
  justLit?: number | null
  /** all lit bulbs blink together once (4/4) */
  celebrate?: boolean
  className?: string
  label?: string
}

/**
 * A small light string hung across the top of the scene (DESIGN.md: bulbs ±14–18 px, wire runs
 * past both edges, glow never clipped). The SVG is wider than its box and overflow stays visible.
 * Doubles as the progress indicator: lit bulbs = stamped booths.
 */
export function LightString({ lit, count = 4, sequence = false, justLit = null, celebrate = false, className = '', label }: Props) {
  const reduce = useReducedMotion()
  const W = 300
  const H = 46
  // wire sags gently between the bulbs and keeps rising beyond both edges, drawn far past the
  // viewBox so it always leaves the screen whatever the aspect ratio
  const wireY = (x: number) => (x < 0 ? 9 + x * 0.05 : x > W ? 9 - (x - W) * 0.05 : 9 + 9 * Math.sin((x / W) * Math.PI))
  const xs = Array.from({ length: count }, (_, i) => 46 + i * ((W - 92) / Math.max(1, count - 1)))
  const allLit = lit === 'all'
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ overflow: 'visible' }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path
        d={`M-600 ${wireY(-600)} ${Array.from({ length: 151 }, (_, i) => {
          const x = -600 + i * 10
          return `L${x} ${wireY(x)}`
        }).join(' ')}`}
        fill="none"
        stroke="#2a1d1f"
        strokeWidth="1.6"
      />
      {xs.map((x, i) => {
        const y = wireY(x) + 2
        const on = allLit || i < (lit as number)
        const color = BULB_COLORS[i % BULB_COLORS.length]
        const animateOn = !reduce && on && (sequence || justLit === i || celebrate)
        const keyframes = celebrate ? [1, 0.25, 1] : justLit === i ? [0, 1, 0.1, 1, 0.25, 1] : FLICKER
        return (
          <g key={i}>
            <rect x={x - 2.5} y={y - 1} width="5" height="5" rx="1" fill="#3b3133" />
            {on ? (
              <motion.g
                initial={animateOn ? { opacity: 0 } : false}
                animate={{ opacity: animateOn ? keyframes : 1 }}
                transition={{ duration: celebrate ? 0.6 : 0.9, delay: sequence ? 0.25 + i * 0.28 + (i % 2) * 0.09 : 0 }}
              >
                {/* halo is a soft blob inside the visible overflow — never clipped */}
                <circle cx={x} cy={y + 13} r="15" fill={color} opacity="0.16" />
                <circle cx={x} cy={y + 13} r="9" fill={color} opacity="0.22" />
                <ellipse cx={x} cy={y + 13} rx="5.5" ry="8" fill={color} />
                <ellipse cx={x - 1.6} cy={y + 10} rx="1.4" ry="2.6" fill="#fff6e8" opacity="0.5" />
              </motion.g>
            ) : (
              <ellipse cx={x} cy={y + 13} rx="5.5" ry="8" fill={color} fillOpacity="0.14" stroke={color} strokeOpacity="0.45" strokeWidth="1" />
            )}
          </g>
        )
      })}
    </svg>
  )
}
