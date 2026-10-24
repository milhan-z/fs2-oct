// All display times are Asia/Jakarta (WIB). In mock mode the dev panel can shift "now".

const OFFSET_KEY = 'fs2.dev.timeOffset'
const TZ = 'Asia/Jakarta'

export function getTimeOffset(): number {
  try {
    return Number(localStorage.getItem(OFFSET_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

export function setTimeOffset(ms: number) {
  localStorage.setItem(OFFSET_KEY, String(ms))
  window.dispatchEvent(new Event('fs2-time-change'))
}

export function nowMs(): number {
  return Date.now() + (import.meta.env.VITE_DATA_MODE === 'supabase' ? 0 : getTimeOffset())
}

export function nowIso(): string {
  return new Date(nowMs()).toISOString()
}

const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDay = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short' })
const fullFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** "15:48" */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return hm.format(new Date(iso))
}

/** "Wednesday 28 October 2026" */
export function fmtDay(iso: string): string {
  return dayFmt.format(new Date(iso))
}

/** "Thursday 29 Oct, 23:59" */
export function fmtDeadline(iso: string): string {
  return `${shortDay.format(new Date(iso)).replace(',', '')}, ${fmtTime(iso)}`
}

/** "28/10/2026 15:48:02" — for exports */
export function fmtFull(iso: string | null | undefined): string {
  if (!iso) return ''
  return fullFmt.format(new Date(iso)).replace(',', '')
}

export function relTime(iso: string, now = nowMs()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 4) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  return fmtTime(iso)
}

/** ISO (+07:00) → value for <input type="datetime-local"> in WIB */
export function isoToLocalInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  return d.toISOString().slice(0, 16)
}

export function localInputToIso(v: string): string {
  return `${v}:00+07:00`
}

export type SessionPhase = 'before' | 'open' | 'after'

export function sessionPhase(start: string, end: string, now = nowMs()): SessionPhase {
  if (now < new Date(start).getTime()) return 'before'
  if (now > new Date(end).getTime()) return 'after'
  return 'open'
}
