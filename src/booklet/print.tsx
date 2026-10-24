import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { GenericStamp } from '../components/decor'

// Printed-object primitives for the passport (DESIGN.md §5). Everything here is something you
// could find on a real document: page numbers, serials, MRZ, ink stamps, tickets, tape.

/** Stable pseudo-random number in [0,1) from a string — keeps stamp rotation identical across renders. */
export function seeded(key: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/** Folio line at the top of a page: printed header left, serial right (Courier). */
export function Folio({ left, serial, className = '' }: { left?: ReactNode; serial?: string; className?: string }) {
  return (
    <div className={`flex min-w-0 items-baseline justify-between gap-3 font-mono text-[11px] tracking-[0.1em] whitespace-nowrap text-ink/65 ${className}`}>
      <span className="min-w-0 truncate uppercase">{left}</span>
      {serial && <span className="flex-none">No. {serial}</span>}
    </div>
  )
}

/** Page number, bottom right, as printed in the gutter. */
export function PageNo({ n }: { n: string | number }) {
  return (
    <span className="pointer-events-none absolute right-4 bottom-2.5 font-mono text-[11px] text-ink/45" aria-hidden="true">
      {String(n).padStart(2, '0')}
    </span>
  )
}

/** Form-style field label (Poppins 10.5 caps). */
export function DocLabel({ children, htmlFor, className = '' }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return htmlFor ? (
    <label htmlFor={htmlFor} className={`doc-label block ${className}`}>
      {children}
    </label>
  ) : (
    <span className={`doc-label block ${className}`}>{children}</span>
  )
}

/** Thin printed rule (1 px ink 15%). */
export function Rule({ className = '' }: { className?: string }) {
  return <hr className={`border-0 border-t border-ink/15 ${className}`} />
}

const mrzName = (s: string) =>
  s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[^A-Z ]/g, '')
    .trim()
    .replace(/\s+/g, '<')

/** Machine readable zone — 2 lines, padded with '<'. Optional typewriter reveal. */
export function MRZ({ name, last4, reveal = false, className = '' }: { name: string; last4: string; reveal?: boolean; className?: string }) {
  const reduce = useReducedMotion()
  const L = 36
  const l1 = `P<FS2<<${mrzName(name)}`.padEnd(L, '<').slice(0, L)
  const l2 = `FS2OCT26<<${last4}<<<ITSGE<<UPSIDEDOWN`.padEnd(L, '<').slice(0, L)
  const full = `${l1}\n${l2}`
  const [shown, setShown] = useState(reveal && !reduce ? 0 : full.length)
  useEffect(() => {
    if (!reveal || reduce) return
    setShown(0)
    const t = setInterval(() => setShown((n) => (n >= full.length ? (clearInterval(t), n) : n + 1)), 18)
    return () => clearInterval(t)
  }, [reveal, reduce, full])
  const text = full.slice(0, shown)
  return (
    <pre aria-hidden="true" className={`overflow-hidden font-mono text-[11.5px] leading-[1.45] tracking-[0.14em] whitespace-pre text-ink/55 ${className}`}>
      {text}
      {shown < full.length && <span className="inline-block h-[1em] w-[0.6em] translate-y-[2px] bg-ink/40" />}
    </pre>
  )
}

/**
 * Ink stamp: country stamp PNG (or the generic FS² stamp) with uneven ink (noise mask), a seeded
 * rotation between −12° and +8°, opacity ±0.9. `pending` = faded print of the empty visa slot.
 */
export function InkStamp({ src, seed, size, alt, pending = false, large = false, className = '', style }: { src: string | null; seed: string; size: number; alt: string; pending?: boolean; large?: boolean; className?: string; style?: CSSProperties }) {
  const rot = -12 + seeded(seed) * 20
  const url = src && large && src.startsWith('/assets/stamps/') ? src.replace(/\.webp$/, '-lg.webp') : src
  const mask = { WebkitMaskImage: 'var(--tex-ink-mask)', maskImage: 'var(--tex-ink-mask)', WebkitMaskSize: '140px', maskSize: '140px' } as CSSProperties
  return (
    <div className={`relative flex-none ${className}`} style={{ width: size, height: size, transform: `rotate(${rot.toFixed(1)}deg)`, ...style }}>
      <div className="h-full w-full" style={{ ...mask, opacity: pending ? 0.3 : 0.9 }}>
        {url ? <img src={url} alt={alt} className="h-full w-full object-contain" draggable={false} /> : <GenericStamp className="h-full w-full" />}
      </div>
      {pending && <span className="absolute inset-[6%] rounded-full border-[1.5px] border-dashed border-stamp/45" aria-hidden="true" />}
    </div>
  )
}

/** Small round ink mark used for map pins and checklists (same visual language as stamps). */
export function InkMark({ state, code, size = 26 }: { state: 'none' | 'stamped' | 'done'; code: string; size?: number }) {
  const filled = state !== 'none'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ overflow: 'visible' }}>
      <circle cx="20" cy="20" r="17" fill={filled ? '#b3261e' : 'none'} fillOpacity={filled ? 0.9 : 0} stroke="#b3261e" strokeWidth={filled ? 0 : 2.4} />
      <circle cx="20" cy="20" r="13.5" fill="none" stroke={filled ? '#fbf3ea' : '#b3261e'} strokeOpacity={filled ? 0.55 : 0.7} strokeWidth="1" strokeDasharray={filled ? '0' : '2 2'} />
      <text x="20" y="25" textAnchor="middle" fontFamily="Anton" fontSize="13" fill={filled ? '#fbf3ea' : '#b3261e'}>
        {code}
      </text>
      {state === 'done' && <path d="M27 31l4 4 8-10" fill="none" stroke="#2e7d32" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

/** Booth code for marks: "South Korea" → KR, "Taiwan" → TW, "Germany" → DE, "Booth 4" → 4. */
export function boothCode(nama: string, sort: number): string {
  const KNOWN: Record<string, string> = { korea: 'KR', taiwan: 'TW', germany: 'DE', japan: 'JP', china: 'CN', netherlands: 'NL', australia: 'AU', france: 'FR', 'united kingdom': 'UK', singapore: 'SG', malaysia: 'MY' }
  const n = nama.toLowerCase()
  if (n.startsWith('booth')) return String(sort)
  for (const [k, v] of Object.entries(KNOWN)) if (n.includes(k)) return v
  return nama.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || String(sort)
}

/** Navy tape strip (printed label stuck on the page). */
export function Tape({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-block -rotate-2 bg-tape px-2.5 py-1 text-[13px] font-semibold text-[#f3ebdd] shadow-[var(--shadow-contact)] ${className}`}>{children}</span>
}

/** Perforated ticket paper (QR permit, onboarding note). */
export function TicketPaper({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`mat-ticket relative shadow-[var(--shadow-lift)] ${className}`} style={style}>
      {/* perforation: holes punched along the top edge, showing the night behind */}
      <div className="pointer-events-none absolute inset-x-0 -top-[5px] flex justify-between px-2" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="h-[10px] w-[10px] rounded-full bg-night-0" />
        ))}
      </div>
      {children}
    </div>
  )
}

/** Skeleton of a passport page: printed rules and the photo box show at once; data arrives later. */
export function PageSkeleton({ photo = false }: { photo?: boolean }) {
  return (
    <div className="flex flex-col gap-4 px-6 pt-8" aria-busy="true" aria-label="Loading page">
      <div className="h-3 w-28 rounded-[2px] bg-ink/10" />
      <div className="h-8 w-3/4 rounded-[2px] bg-ink/10" />
      {photo && <div className="aspect-[3/4] w-32 rounded-[2px] border border-dashed border-ink/25" />}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mt-3 border-b border-ink/15 pb-3">
          <div className="h-2 w-20 rounded-[2px] bg-ink/10" />
        </div>
      ))}
    </div>
  )
}

/** Press feedback for buttons: ink darkens / scale .98 within one frame (no bounce). */
export const press = { whileTap: { scale: 0.98 }, transition: { duration: 0.06 } } as const

/** Paper slip clipped to the page (committee notes). */
export function ClippedSlip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={`relative rotate-[1.5deg] bg-[#fbf3d9] px-4 pt-4 pb-3 text-[14px] text-ink shadow-[var(--shadow-lift)] ${className}`}>
      <svg className="absolute -top-3 left-5 h-7 w-4" viewBox="0 0 16 28" aria-hidden="true">
        <path d="M5 26V6a3 3 0 0 1 6 0v17a2 2 0 0 1-4 0V8" fill="none" stroke="#8a8f99" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {children}
    </motion.div>
  )
}
