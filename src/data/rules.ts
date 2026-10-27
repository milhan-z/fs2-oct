import type { Content, MyState } from './types'
import { nowMs } from './time'
import { roomAt } from '../map/geometry'

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

export function poinOk(s: string, min: number): boolean {
  return wordCount(s) >= min
}

export function resumeDone(state: MyState, boothId: string, min: number): number {
  const r = state.resumes.find((x) => x.boothId === boothId)
  if (!r) return 0
  return r.poin.filter((p) => poinOk(p, min)).length
}

/** How many booths a participant has to finish (stamp + notes). More booths may exist; the rest are optional. */
export const requiredBooths = (content: Pick<Content, 'rules' | 'booths'>) => Math.min(content.rules.jumlah_booth_wajib, content.booths.length)

export interface Progress {
  /** booths that must be finished */
  required: number
  stamped: Set<string>
  stampCount: number
  resumeComplete: Set<string>
  resumeCount: number
  feedbackRequired: number
  feedbackAnswered: number
  feedbackDone: boolean
  allDone: boolean
  pastDeadline: boolean
  locked: boolean
}

export function progress(state: MyState, content: Content): Progress {
  const { rules, questions, booths } = content
  const stamped = new Set(state.visits.map((v) => v.boothId))
  const resumeComplete = new Set(
    booths.filter((b) => stamped.has(b.id) && resumeDone(state, b.id, rules.min_kata_per_poin) >= rules.poin_per_resume).map((b) => b.id),
  )
  const required = questions.filter((q) => q.wajib)
  const answered = required.filter((q) => {
    const a = state.answers.find((x) => x.questionId === q.id)
    return q.tipe === 'skala_1_5' ? !!a?.nilaiInt : !!a?.nilaiTeks?.trim()
  }).length
  const total = requiredBooths(content)
  const pastDeadline = nowMs() > new Date(content.settings.deadline).getTime()
  const locked = state.submission?.status === 'submitted' || state.submission?.status === 'approved'
  return {
    required: total,
    stamped,
    stampCount: stamped.size,
    resumeComplete,
    resumeCount: resumeComplete.size,
    feedbackRequired: required.length,
    feedbackAnswered: answered,
    feedbackDone: answered === required.length,
    allDone: stamped.size >= total && resumeComplete.size >= total && answered === required.length,
    pastDeadline,
    locked,
  }
}

export function maskNrp(nrp: string): string {
  return `••••${nrp.slice(-4)}`
}

export function submissionCode(nrp: string, version: number): string {
  return `FS2-${nrp.slice(-4)}-${String.fromCharCode(64 + Math.min(version, 26))}`
}

/** The room (a label with `batas`) a booth stands in; booths outside every room count as the Lounge. */
export function boothRoom(b: { x: number; y: number }, content: Pick<Content, 'rooms'>): string {
  return roomAt(content.rooms, b.x, b.y) ?? content.rooms.find((r) => r.sorot)?.label ?? 'Lounge'
}

/** Rooms that have booths, in map order, with how many: [{label: 'Lounge', n: 3}, {label: 'Partnership', n: 2}]. */
export function roomCounts(content: Pick<Content, 'rooms' | 'booths'>): { label: string; n: number }[] {
  return content.rooms
    .filter((r) => r.batas)
    .map((r) => ({ label: r.label, n: content.booths.filter((b) => boothRoom(b, content) === r.label).length }))
    .filter((r) => r.n > 0)
}

/** "3 in the Lounge and 2 in the Partnership room" */
export function roomSummary(content: Pick<Content, 'rooms' | 'booths'>): string {
  const name = (l: string) => (l === 'Lounge' ? 'the Lounge' : `the ${l} room`)
  return roomCounts(content)
    .map((r) => `${r.n} in ${name(r.label)}`)
    .join(' and ')
}

/** "top right" etc. — relative position inside the booth's room, derived from the pin point (a narrow room only top/bottom) */
export function roomSpot(x: number, y: number, content: Content): string {
  const room = content.rooms.find((r) => r.batas && roomAt([r], x, y))?.batas
  if (!room) return ''
  const v = y < room.y + room.h / 2 ? 'top' : 'bottom'
  if (room.w < room.h * 0.5) return v
  return `${v} ${x < room.x + room.w / 2 ? 'left' : 'right'}`
}
