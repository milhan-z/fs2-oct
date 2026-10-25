import { motion, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'

export function DemogorgonFlower({ size = 70, rotate = 0, className = '', style }: { size?: number; rotate?: number; className?: string; style?: CSSProperties }) {
  const reduce = useReducedMotion()
  return (
    <motion.img
      src="/assets/gsm/flower.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      className={`object-contain ${className}`}
      style={style}
      initial={{ rotate }}
      animate={reduce ? undefined : { rotate: [rotate - 4, rotate + 4, rotate - 4] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

/** Official partner logos strip (Kemitraan Global · ITS · …) from the GSM header. */
export function LogoStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-full bg-white px-4 py-1.5 shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${className}`}>
      <img src="/assets/gsm/logo-partners.webp" alt="Directorate of Global Partnership ITS and partners" width={624} height={57} className="mx-auto block h-auto w-full" draggable={false} />
    </div>
  )
}

/** Generic "FS² October Edition" stamp — used until a booth has its own stamp. */
export function GenericStamp({ label = 'FS²', className = '' }: { label?: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Cap FS² October Edition">
      <defs>
        <path id="stamp-arc-top" d="M30 100 a70 70 0 0 1 140 0" />
        <path id="stamp-arc-bot" d="M38 112 a62 62 0 0 0 124 0" />
      </defs>
      <g fill="none" stroke="#b3262a" opacity="0.92">
        <circle cx="100" cy="100" r="92" strokeWidth="6" />
        <circle cx="100" cy="100" r="84" strokeWidth="2" />
        <circle cx="100" cy="100" r="50" strokeWidth="2" strokeDasharray="4 4" />
      </g>
      <g fill="#b3262a" opacity="0.92">
        <text fontFamily="Libre Baskerville, serif" fontWeight="700" fontSize="17" letterSpacing="3">
          <textPath href="#stamp-arc-top" startOffset="50%" textAnchor="middle">STUDENT BOOTH</textPath>
        </text>
        <text fontFamily="Libre Baskerville, serif" fontWeight="700" fontSize="15" letterSpacing="2">
          <textPath href="#stamp-arc-bot" startOffset="50%" textAnchor="middle">OCTOBER EDITION</textPath>
        </text>
        <text x="100" y="114" textAnchor="middle" fontFamily="Libre Baskerville, serif" fontWeight="700" fontSize="40">{label}</text>
      </g>
    </svg>
  )
}

export function StampImg({ src, alt, large = false, className = '' }: { src: string | null; alt: string; large?: boolean; className?: string }) {
  if (!src) return <GenericStamp className={className} />
  const url = large && src.startsWith('/assets/stamps/') ? src.replace(/\.webp$/, '-lg.webp') : src
  return <img src={url} alt={alt} className={`object-contain ${className}`} draggable={false} />
}

/** Retro TV frame (Coming Soon slides). Plays a "TV switching on" effect when `on` changes to true. */
export function RetroTV({ src, alt, className = '', powerKey }: { src: string | null; alt: string; className?: string; powerKey?: string }) {
  const reduce = useReducedMotion()
  return (
    <div className={`relative rounded-[18px] bg-[#6b4226] p-[10px] pr-[34px] shadow-[inset_0_0_0_3px_#3a2416,0_6px_14px_rgba(0,0,0,0.4)] ${className}`}>
      <div className="relative aspect-[4/3.2] overflow-hidden rounded-[12px] bg-[#1b1f27] shadow-[inset_0_0_0_4px_#2a1a10]">
        <motion.div
          key={powerKey}
          className="absolute inset-0"
          initial={reduce ? { opacity: 0 } : { scaleY: 0.01, scaleX: 0, opacity: 1, filter: 'brightness(3)' }}
          animate={reduce ? { opacity: 1 } : { scaleY: [0.01, 0.01, 1], scaleX: [0, 1, 1], filter: ['brightness(3)', 'brightness(3)', 'brightness(1)'] }}
          transition={{ duration: 0.45, times: [0, 0.4, 1], ease: 'easeOut' }}
        >
          {src ? (
            <img src={src} alt={alt} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#5a6170] to-[#262b35]" role="img" aria-label={`${alt} (foto menyusul)`}>
              <svg viewBox="0 0 60 60" className="h-[70%] opacity-60" aria-hidden="true">
                <circle cx="30" cy="22" r="11" fill="#c9ced8" />
                <path d="M8 58c2-14 11-21 22-21s20 7 22 21z" fill="#c9ced8" />
              </svg>
            </div>
          )}
          {/* scanlines */}
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.12)_0_2px,transparent_2px_4px)]" />
        </motion.div>
      </div>
      <div className="absolute top-[22%] right-[8px] h-[18px] w-[18px] rounded-full bg-[#2a1a10]" />
      <div className="absolute top-[46%] right-[8px] h-[18px] w-[18px] rounded-full bg-[#2a1a10]" />
    </div>
  )
}

/** Front cover: navy cloth with gold foil emboss. Text scales with the cover width (container units). */
export function PassportCover({ tagline }: { tagline: string }) {
  return (
    <div className="@container mat-cover relative h-full w-full rounded-[3px_5px_5px_3px] shadow-[var(--shadow-lift)]">
      {/* hinge crease near the spine */}
      <div className="absolute inset-y-0 left-[5%] w-px bg-black/25 shadow-[1px_0_0_rgba(255,255,255,0.05)]" aria-hidden="true" />
      <div className="absolute inset-[6%] flex flex-col items-center justify-between rounded-[2px] border border-emboss/70 py-[10%] text-center font-mono text-emboss">
        <div className="emboss text-[4.6cqw] font-bold tracking-[0.5em]">PASSPORT</div>
        <div className="flex flex-col items-center gap-[4cqw]">
          <div className="flex aspect-square w-[36cqw] items-center justify-center rounded-full border-[1.5px] border-emboss/80">
            <span className="emboss font-serif text-[12cqw] font-bold">
              FS<sup className="text-[0.55em]">2</sup>
            </span>
          </div>
          <div className="emboss px-[8cqw] text-[3.8cqw] tracking-[0.26em]">FROM STUDENTS FOR STUDENTS</div>
        </div>
        <p className="neon-text flicker-once px-[7cqw] font-serif text-[7cqw] leading-[1.3] font-bold">{tagline}</p>
        <div className="emboss px-[6cqw] text-[3.4cqw] tracking-[0.24em]">STUDENT BOOTH · SPECIAL EDITION</div>
      </div>
    </div>
  )
}

export function GrandfatherClock({ className = '' }: { className?: string }) {
  return <img src="/assets/gsm/clock.svg" alt="" aria-hidden="true" className={`object-contain ${className}`} draggable={false} />
}

// --- icons -----------------------------------------------------------------

type IconProps = { className?: string }
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const Icon = {
  Map: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>
  ),
  Qr: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3M21 14v7h-4M14 18v3" /></svg>
  ),
  Passport: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M9 16h6" /></svg>
  ),
  Back: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  ),
  Close: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  Check: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} strokeWidth={3} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ),
  Sun: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeDasharray="0" /></svg>
  ),
  Flip: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><path d="M9 13a3 3 0 0 1 5.2-2M15 13a3 3 0 0 1-5.2 2M14 9.5V11h-1.5M10 16.5V15h1.5" /></svg>
  ),
  Cloud: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z" /></svg>
  ),
  Book: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16" /></svg>
  ),
  Toilet: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><circle cx="7" cy="4" r="2" /><circle cx="17" cy="4" r="2" /><path d="M5 7h4l1 7H8v8H6v-8H4zM14.5 7h5l2 8h-2.5v7h-4v-7H12.5z" /></svg>
  ),
  Mosque: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M12 2c3 2.5 5 4.5 5 7H7c0-2.5 2-4.5 5-7zM5 10h14v12H14v-5a2 2 0 0 0-4 0v5H5z" /></svg>
  ),
  Pin: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" /></svg>
  ),
}
