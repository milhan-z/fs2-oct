import type { Content, MyState } from './types'
import { nowMs } from './time'

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

export interface Progress {
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
  const total = Math.min(rules.jumlah_booth_wajib, booths.length)
  const pastDeadline = nowMs() > new Date(content.settings.deadline).getTime()
  const locked = state.submission?.status === 'submitted' || state.submission?.status === 'approved'
  return {
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

/** "top right" etc. — relative position inside the Lounge, derived from the pin point */
export function loungeSpot(x: number, y: number, content: Content): string {
  const lounge = content.rooms.find((r) => r.batas)?.batas
  if (!lounge) return ''
  const h = x < lounge.x + lounge.w / 2 ? 'left' : 'right'
  const v = y < lounge.y + lounge.h / 2 ? 'top' : 'bottom'
  return `${v} ${h}`
}
