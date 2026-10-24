import type { Api } from './api'
import {
  ApiError,
  type Answer,
  type Content,
  type ExportData,
  type MyState,
  type ResolvedToken,
  type SubmissionStatus,
} from './types'
import { DEPARTEMEN_ITS, seedContent } from './seed'
import { nowIso, nowMs, sessionPhase } from './time'
import { buildExport } from './exportBuilder'
import { maskNrp, poinOk, submissionCode } from './rules'

// ---------------------------------------------------------------------------
// In-memory + localStorage backend for demos. Mirrors the RPC semantics of the
// Supabase backend (rate limits, scan window, locking) so the UI behaves the same.
// ---------------------------------------------------------------------------

const DB_KEY = 'fs2.mockdb'
const SESSION_P = 'fs2.session.participant'
const SESSION_ADMIN = 'fs2.session.admin'
const sessionStaffKey = (slug: string) => `fs2.session.staff.${slug}`

export const MOCK_STAFF_PINS: Record<string, string> = { B1: '1111', B2: '2222', B3: '3333', B4: '4444' }
/** shared staff (runner) PIN in the mock — works for every booth */
export const MOCK_STAFF_MASTER_PIN = '555555'
const SESSION_STAFF_ROAM = 'fs2.session.staffAll'
export const MOCK_ADMIN_PASSWORD = 'fs2admin'

interface PRow {
  id: string
  nrp: string
  nama: string
  departemen: string
  angkatan: string
  photo: string | null
  createdAt: string
}
interface AuthRow {
  pinHash: string
  failed: number
  lockedUntil: number
  qrToken: string
  /** a PIN reset is open until this time (ms): the participant chooses the new PIN at sign-in */
  resetUntil?: number
}
interface SessionRow {
  role: 'participant' | 'staff' | 'admin'
  subject: string
  boothId?: string
  expiresAt: number
}
interface VisitRow {
  id: string
  participantId: string
  boothId: string
  scannedAt: string
  confirmedAt: string
  confirmedBy: string
  cancelledAt: string | null
}
interface ResumeRow {
  participantId: string
  boothId: string
  poin: [string, string, string]
  updatedAt: string
}
interface SubmissionRow {
  id: string
  participantId: string
  version: number
  status: SubmissionStatus
  submittedAt: string
  reviewedAt: string | null
  reviewerNote: string | null
}
interface DB {
  v: 2
  content: Omit<Content, 'departemen'>
  participants: PRow[]
  auth: Record<string, AuthRow>
  sessions: Record<string, SessionRow>
  staffPins: Record<string, string>
  staffMaster?: string
  adminHash: string
  visits: VisitRow[]
  resumes: ResumeRow[]
  answers: (Answer & { participantId: string })[]
  submissions: SubmissionRow[]
  stamp4it: Record<string, { given: boolean; givenAt: string | null }>
  audit: { actor: string; action: string; target: string; at: string }[]
}

// --- helpers ---------------------------------------------------------------

function rid(bytes = 16): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Small sync hash — the mock never leaves the browser; the real backend uses bcrypt. */
function hash(s: string): string {
  let h1 = 0xdeadbeef ^ s.length
  let h2 = 0x41c6ce57 ^ s.length
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16)
}

function randomPin(): string {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return String(a[0] % 10000).padStart(4, '0')
}

function freshDb(): DB {
  return {
    v: 2,
    content: seedContent(),
    participants: [],
    auth: {},
    sessions: {},
    staffPins: Object.fromEntries(Object.entries(MOCK_STAFF_PINS).map(([k, v]) => [k, hash(v)])),
    staffMaster: hash(MOCK_STAFF_MASTER_PIN),
    adminHash: hash(MOCK_ADMIN_PASSWORD),
    visits: [],
    resumes: [],
    answers: [],
    submissions: [],
    stamp4it: {},
    audit: [],
  }
}

let db: DB = load()

function load(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.v === 2) return { ...parsed, staffMaster: parsed.staffMaster ?? hash(MOCK_STAFF_MASTER_PIN) }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return freshDb()
}

function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch (e) {
    console.warn('mock db save failed (storage full?)', e)
  }
  window.dispatchEvent(new Event('fs2-mock-change'))
}

// Other tabs (e.g. staff scanner in a second tab) write the same key.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY) {
      db = load()
      window.dispatchEvent(new Event('fs2-mock-change'))
    }
  })
}

const delay = (ms = 80 + Math.random() * 120) => new Promise((r) => setTimeout(r, ms))

function newSession(row: Omit<SessionRow, 'expiresAt'>): string {
  const token = rid(32)
  db.sessions[hash(token)] = { ...row, expiresAt: nowMs() + 3 * 86400_000 }
  return token
}

function readSession(key: string, role: SessionRow['role']): SessionRow | null {
  const token = localStorage.getItem(key)
  if (!token) return null
  const s = db.sessions[hash(token)]
  if (!s || s.role !== role || s.expiresAt < Date.now()) return null
  return s
}

function requireParticipant(): PRow {
  const s = readSession(SESSION_P, 'participant')
  const p = s && db.participants.find((x) => x.id === s.subject)
  if (!p) throw new ApiError('auth', 'Session expired. Sign in again with your NRP + PIN.')
  return p
}

function requireStaff(slug: string): { boothId: string } {
  const s = readSession(sessionStaffKey(slug), 'staff')
  if (!s?.boothId) throw new ApiError('auth', 'Officer session expired. Enter the booth PIN again.')
  return { boothId: s.boothId }
}

function requireAdmin() {
  if (!readSession(SESSION_ADMIN, 'admin')) throw new ApiError('auth', 'Admin session expired.')
}

function scanOpen(): boolean {
  const s = db.content.settings
  return s.simulationMode || sessionPhase(s.sessionStart, s.sessionEnd) === 'open'
}

function activeVisits(pid?: string) {
  return db.visits.filter((v) => !v.cancelledAt && (!pid || v.participantId === pid))
}

function audit(actor: string, action: string, target: string) {
  db.audit.push({ actor, action, target, at: nowIso() })
}

function boothBySlug(slug: string) {
  const b = db.content.booths.find((x) => x.slug === slug)
  if (!b) throw new ApiError('not_found', 'Booth not found.')
  return b
}

function myState(p: PRow): MyState {
  const sub = db.submissions.find((s) => s.participantId === p.id) ?? null
  return {
    participant: {
      id: p.id,
      nama: p.nama,
      nrpMasked: maskNrp(p.nrp),
      nrpLast4: p.nrp.slice(-4),
      departemen: p.departemen,
      angkatan: p.angkatan,
      photo: p.photo,
    },
    qrToken: db.auth[p.id].qrToken,
    visits: activeVisits(p.id).map((v) => ({ id: v.id, boothId: v.boothId, confirmedAt: v.confirmedAt })),
    resumes: db.resumes.filter((r) => r.participantId === p.id).map(({ boothId, poin, updatedAt }) => ({ boothId, poin, updatedAt })),
    answers: db.answers.filter((a) => a.participantId === p.id).map(({ questionId, nilaiInt, nilaiTeks }) => ({ questionId, nilaiInt, nilaiTeks })),
    submission: sub && { ...sub, code: submissionCode(p.nrp, sub.version) },
    stamp4it: !!db.stamp4it[p.id]?.given,
    serverNow: nowIso(),
  }
}

function assertEditable(pid: string) {
  const sub = db.submissions.find((s) => s.participantId === pid)
  if (sub && sub.status !== 'revision') throw new ApiError('locked', 'Your submission has been sent — editing is locked.')
}

async function shrinkImage(blob: Blob, max = 320, quality = 0.6): Promise<string> {
  const bmp = await createImageBitmap(blob)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

function resolveParticipant(p: PRow, boothId: string, token: string): ResolvedToken {
  const dup = activeVisits(p.id).some((v) => v.boothId === boothId)
  return { token, kind: dup ? 'duplicate' : 'ok', participantId: p.id, nama: p.nama, nrpMasked: maskNrp(p.nrp), photo: p.photo }
}

// --- adapter ---------------------------------------------------------------

export const mockAdapter: Api = {
  mode: 'mock',

  async getContent() {
    await delay(40)
    return { ...structuredClone(db.content), departemen: DEPARTEMEN_ITS }
  },

  async checkNrp(nrp) {
    await delay()
    const p = db.participants.find((x) => x.nrp === nrp.trim())
    return { exists: !!p, reset: !!p && (db.auth[p.id]?.resetUntil ?? 0) > Date.now() }
  },

  async setPin(nrp, pin) {
    await delay()
    if (!/^\d{4}$/.test(pin)) throw new ApiError('invalid', 'PIN must be 4 digits.')
    const p = db.participants.find((x) => x.nrp === nrp.trim())
    if (!p) throw new ApiError('not_found', 'This NRP is not registered yet.')
    const a = db.auth[p.id]
    if ((a.resetUntil ?? 0) <= Date.now()) throw new ApiError('no_reset', 'No PIN reset is open for this NRP. Ask the committee to reset it.')
    Object.assign(a, { pinHash: hash(pin), failed: 0, lockedUntil: 0, resetUntil: 0 })
    localStorage.setItem(SESSION_P, newSession({ role: 'participant', subject: p.id }))
    save()
  },

  async login(nrp, pin) {
    await delay()
    const p = db.participants.find((x) => x.nrp === nrp.trim())
    if (!p) throw new ApiError('not_found', 'This NRP is not registered yet.')
    const a = db.auth[p.id]
    if ((a.resetUntil ?? 0) > Date.now()) throw new ApiError('reset_pending', 'Your PIN was reset. Enter your NRP again to choose a new one.')
    if (a.lockedUntil > Date.now()) {
      const m = Math.ceil((a.lockedUntil - Date.now()) / 60000)
      throw new ApiError('locked', `Too many attempts. Try again in ${m} minute${m === 1 ? '' : 's'}.`)
    }
    if (a.pinHash !== hash(pin)) {
      a.failed += 1
      if (a.failed >= 5) {
        a.lockedUntil = Date.now() + 5 * 60000
        a.failed = 0
      }
      save()
      throw new ApiError('bad_pin', 'Wrong PIN.')
    }
    a.failed = 0
    localStorage.setItem(SESSION_P, newSession({ role: 'participant', subject: p.id }))
    save()
  },

  async register(input) {
    await delay()
    const nrp = input.nrp.trim()
    if (!/^\d{4,14}$/.test(nrp)) throw new ApiError('invalid', 'Invalid NRP.')
    if (!/^\d{4}$/.test(input.pin)) throw new ApiError('invalid', 'PIN must be 4 digits.')
    if (db.participants.some((p) => p.nrp === nrp)) throw new ApiError('exists', 'This NRP already has a passport. Sign in with your PIN.')
    const id = rid(8)
    db.participants.push({
      id,
      nrp,
      nama: input.nama.trim(),
      departemen: input.departemen.trim(),
      angkatan: input.angkatan,
      photo: null,
      createdAt: nowIso(),
    })
    db.auth[id] = { pinHash: hash(input.pin), failed: 0, lockedUntil: 0, qrToken: rid(12) }
    localStorage.setItem(SESSION_P, newSession({ role: 'participant', subject: id }))
    save()
  },

  hasSession() {
    return !!readSession(SESSION_P, 'participant')
  },

  logout() {
    localStorage.removeItem(SESSION_P)
  },

  async getMyState() {
    await delay(30)
    return myState(requireParticipant())
  },

  async uploadPhoto(file) {
    const p = requireParticipant()
    const url = await shrinkImage(file)
    p.photo = url
    save()
    return url
  },

  async saveResume(boothId, poin) {
    await delay()
    const p = requireParticipant()
    assertEditable(p.id)
    if (!activeVisits(p.id).some((v) => v.boothId === boothId)) throw new ApiError('not_stamped', 'This booth has not been stamped yet.')
    const updatedAt = nowIso()
    const row = db.resumes.find((r) => r.participantId === p.id && r.boothId === boothId)
    if (row) Object.assign(row, { poin, updatedAt })
    else db.resumes.push({ participantId: p.id, boothId, poin, updatedAt })
    save()
    return updatedAt
  },

  async saveFeedback(answers) {
    await delay()
    const p = requireParticipant()
    assertEditable(p.id)
    db.answers = db.answers.filter((a) => a.participantId !== p.id)
    for (const a of answers) db.answers.push({ ...a, participantId: p.id })
    save()
  },

  async submit() {
    await delay(300)
    const p = requireParticipant()
    const c = db.content
    if (nowMs() > new Date(c.settings.deadline).getTime()) throw new ApiError('deadline', 'The submission deadline has passed.')
    const visits = activeVisits(p.id)
    const need = Math.min(c.rules.jumlah_booth_wajib, c.booths.length)
    if (visits.length < need) throw new ApiError('incomplete', 'Not all booths are stamped yet.')
    const complete = c.booths.filter((b) => {
      const r = db.resumes.find((x) => x.participantId === p.id && x.boothId === b.id)
      return r && r.poin.filter((x) => poinOk(x, c.rules.min_kata_per_poin)).length >= c.rules.poin_per_resume
    })
    if (complete.length < need) throw new ApiError('incomplete', 'Booth notes are not complete yet.')
    for (const q of c.questions.filter((x) => x.wajib)) {
      const a = db.answers.find((x) => x.participantId === p.id && x.questionId === q.id)
      if (!(a?.nilaiInt || a?.nilaiTeks?.trim())) throw new ApiError('incomplete', 'Required feedback is missing.')
    }
    const sub = db.submissions.find((s) => s.participantId === p.id)
    if (sub && sub.status !== 'revision') throw new ApiError('locked', 'Your submission has already been sent.')
    if (sub) Object.assign(sub, { version: sub.version + 1, status: 'submitted', submittedAt: nowIso(), reviewedAt: null })
    else
      db.submissions.push({
        id: rid(8),
        participantId: p.id,
        version: 1,
        status: 'submitted',
        submittedAt: nowIso(),
        reviewedAt: null,
        reviewerNote: null,
      })
    save()
  },

  // --- staff ---------------------------------------------------------------

  async staffLogin(slug, pin) {
    await delay()
    const master = !!db.staffMaster && db.staffMaster === hash(pin)
    if (!slug) {
      if (!master) throw new ApiError('bad_pin', 'Wrong staff PIN.')
      localStorage.setItem(SESSION_STAFF_ROAM, newSession({ role: 'staff', subject: 'runner' }))
      save()
      return null
    }
    const b = boothBySlug(slug)
    if (!master && db.staffPins[b.id] !== hash(pin)) throw new ApiError('bad_pin', 'Wrong staff PIN.')
    const token = newSession({ role: 'staff', subject: master ? `runner:${b.id}` : `staff-${b.id}`, boothId: b.id })
    localStorage.setItem(sessionStaffKey(slug), token)
    if (master) localStorage.setItem(SESSION_STAFF_ROAM, token)
    save()
    return { boothId: b.id, boothNama: b.nama }
  },

  staffSession(slug) {
    const s = readSession(sessionStaffKey(slug), 'staff')
    if (!s?.boothId) return null
    const b = db.content.booths.find((x) => x.id === s.boothId)
    return b ? { boothId: b.id, boothNama: b.nama } : null
  },

  staffCanSwitch() {
    return !!readSession(SESSION_STAFF_ROAM, 'staff')
  },

  async staffSwitch(slug) {
    await delay()
    const s = readSession(SESSION_STAFF_ROAM, 'staff')
    if (!s || !s.subject.startsWith('runner')) {
      localStorage.removeItem(SESSION_STAFF_ROAM)
      throw new ApiError('auth', 'Sign in with the staff PIN first.')
    }
    const b = boothBySlug(slug)
    localStorage.setItem(sessionStaffKey(slug), newSession({ role: 'staff', subject: `runner:${b.id}`, boothId: b.id }))
    save()
    return { boothId: b.id, boothNama: b.nama }
  },

  staffLogout() {
    for (const k of Object.keys(localStorage)) if (k.startsWith('fs2.session.staff')) localStorage.removeItem(k)
  },

  async staffResolveTokens(slug, tokens) {
    await delay(60)
    const { boothId } = requireStaff(slug)
    return tokens.map((raw) => {
      const token = raw.replace(/^FS2:/, '').trim()
      const pid = Object.entries(db.auth).find(([, a]) => a.qrToken === token)?.[0]
      const p = pid && db.participants.find((x) => x.id === pid)
      if (!p) return { token: raw, kind: 'unknown' as const }
      return resolveParticipant(p, boothId, raw)
    })
  },

  async staffFindByLast4(slug, last4) {
    await delay()
    const { boothId } = requireStaff(slug)
    return db.participants.filter((p) => p.nrp.endsWith(last4)).map((p) => resolveParticipant(p, boothId, `manual:${p.id}`))
  },

  async staffConfirmBatch(slug, participantIds) {
    await delay(250)
    const { boothId } = requireStaff(slug)
    if (!scanOpen()) throw new ApiError('closed', 'The booth session is not open.')
    let n = 0
    const at = nowIso()
    for (const pid of new Set(participantIds)) {
      if (!db.participants.some((p) => p.id === pid)) continue
      if (activeVisits(pid).some((v) => v.boothId === boothId)) continue
      db.visits.push({ id: rid(8), participantId: pid, boothId, scannedAt: at, confirmedAt: at, confirmedBy: `staff-${boothId}`, cancelledAt: null })
      n++
    }
    audit(`staff-${boothId}`, 'confirm_batch', String(n))
    save()
    return n
  },

  async staffHistory(slug) {
    await delay(60)
    const { boothId } = requireStaff(slug)
    return activeVisits()
      .filter((v) => v.boothId === boothId)
      .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))
      .map((v) => {
        const p = db.participants.find((x) => x.id === v.participantId)!
        return { visitId: v.id, participantId: p.id, nama: p.nama, nrpMasked: maskNrp(p.nrp), photo: p.photo, confirmedAt: v.confirmedAt }
      })
  },

  async staffCancelVisit(slug, visitId) {
    await delay()
    const { boothId } = requireStaff(slug)
    const v = db.visits.find((x) => x.id === visitId && x.boothId === boothId && !x.cancelledAt)
    if (!v) throw new ApiError('not_found', 'Visit not found.')
    v.cancelledAt = nowIso()
    audit(`staff-${boothId}`, 'cancel_visit', v.participantId)
    save()
  },

  // --- admin ---------------------------------------------------------------

  async adminLogin(password) {
    await delay()
    if (hash(password) !== db.adminHash) throw new ApiError('bad_password', 'Wrong password.')
    localStorage.setItem(SESSION_ADMIN, newSession({ role: 'admin', subject: 'admin' }))
    save()
  },

  adminHasSession() {
    return !!readSession(SESSION_ADMIN, 'admin')
  },

  adminLogout() {
    localStorage.removeItem(SESSION_ADMIN)
  },

  async adminDashboard() {
    await delay(60)
    requireAdmin()
    const visits = activeVisits()
    const byP = new Map<string, number>()
    for (const v of visits) byP.set(v.participantId, (byP.get(v.participantId) ?? 0) + 1)
    const need = Math.min(db.content.rules.jumlah_booth_wajib, db.content.booths.length)
    const count = (s: SubmissionStatus) => db.submissions.filter((x) => x.status === s).length
    return {
      participants: db.participants.length,
      withPhoto: db.participants.filter((p) => p.photo).length,
      perBooth: db.content.booths.map((b) => ({ boothId: b.id, nama: b.nama, count: visits.filter((v) => v.boothId === b.id).length })),
      allFour: [...byP.values()].filter((n) => n >= need).length,
      submissions: { submitted: count('submitted'), revision: count('revision'), approved: count('approved') },
      stamp4it: Object.values(db.stamp4it).filter((s) => s.given).length,
      recent: [...visits]
        .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))
        .slice(0, 8)
        .map((v) => ({
          nama: db.participants.find((p) => p.id === v.participantId)?.nama ?? '?',
          boothNama: db.content.booths.find((b) => b.id === v.boothId)?.nama ?? v.boothId,
          at: v.confirmedAt,
        })),
    }
  },

  async adminListSubmissions(status, q) {
    await delay(60)
    requireAdmin()
    const needle = q.trim().toLowerCase()
    return db.submissions
      .filter((s) => s.status === status)
      .map((s) => {
        const p = db.participants.find((x) => x.id === s.participantId)!
        return {
          submissionId: s.id,
          participantId: p.id,
          code: submissionCode(p.nrp, s.version),
          nama: p.nama,
          nrp: p.nrp,
          status: s.status,
          version: s.version,
          submittedAt: s.submittedAt,
          boothCount: activeVisits(p.id).length,
        }
      })
      .filter((r) => !needle || r.nama.toLowerCase().includes(needle) || r.nrp.includes(needle))
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  },

  async adminParticipantDetail(pid) {
    await delay(60)
    requireAdmin()
    const p = db.participants.find((x) => x.id === pid)
    if (!p) throw new ApiError('not_found', 'Participant not found.')
    const st = myState(p)
    return {
      id: p.id,
      nrp: p.nrp,
      nama: p.nama,
      departemen: p.departemen,
      angkatan: p.angkatan,
      photo: p.photo,
      createdAt: p.createdAt,
      visits: activeVisits(p.id).map((v) => ({ id: v.id, boothId: v.boothId, confirmedAt: v.confirmedAt, confirmedBy: v.confirmedBy })),
      resumes: st.resumes,
      answers: st.answers,
      submission: st.submission,
      stamp4it: st.stamp4it,
    }
  },

  async adminReview(submissionId, action, note) {
    await delay()
    requireAdmin()
    const s = db.submissions.find((x) => x.id === submissionId)
    if (!s) throw new ApiError('not_found', 'Submission not found.')
    if (action === 'revision' && !note.trim()) throw new ApiError('invalid', 'A note is required when returning a submission.')
    s.status = action === 'approve' ? 'approved' : 'revision'
    s.reviewedAt = nowIso()
    s.reviewerNote = note.trim() || null
    audit('admin', action, s.participantId)
    save()
  },

  async adminSetStamp4it(pid, given) {
    await delay()
    requireAdmin()
    db.stamp4it[pid] = { given, givenAt: given ? nowIso() : null }
    audit('admin', 'stamp4it', pid)
    save()
  },

  async adminListParticipants(q) {
    await delay(60)
    requireAdmin()
    const needle = q.trim().toLowerCase()
    return db.participants
      .filter((p) => !needle || p.nama.toLowerCase().includes(needle) || p.nrp.includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({
        id: p.id,
        nrp: p.nrp,
        nama: p.nama,
        departemen: p.departemen,
        angkatan: p.angkatan,
        hasPhoto: !!p.photo,
        visits: activeVisits(p.id).length,
        status: db.submissions.find((s) => s.participantId === p.id)?.status ?? null,
        locked: db.auth[p.id].lockedUntil > Date.now(),
        resetPending: (db.auth[p.id].resetUntil ?? 0) > Date.now(),
      }))
  },

  async adminResetPin(pid) {
    await delay()
    requireAdmin()
    const a = db.auth[pid]
    if (!a) throw new ApiError('not_found', 'Participant not found.')
    Object.assign(a, { failed: 0, lockedUntil: 0, resetUntil: Date.now() + 24 * 3600_000 })
    // signed out everywhere; the participant chooses the new PIN at the next sign-in
    for (const [k, s] of Object.entries(db.sessions)) if (s.role === 'participant' && s.subject === pid) delete db.sessions[k]
    audit('admin', 'reset_pin', pid)
    save()
  },

  async adminUpdateParticipant(pid, data) {
    await delay()
    requireAdmin()
    const p = db.participants.find((x) => x.id === pid)
    if (!p) throw new ApiError('not_found', 'Participant not found.')
    const nrp = data.nrp.trim()
    if (!/^\d{4,14}$/.test(nrp)) throw new ApiError('invalid', 'NRP must be 4–14 digits.')
    if (data.nama.trim().length < 3) throw new ApiError('invalid', 'Fill in the full name.')
    if (!data.departemen.trim()) throw new ApiError('invalid', 'Fill in the department.')
    if (db.participants.some((x) => x.nrp === nrp && x.id !== pid)) throw new ApiError('exists', 'Another participant already uses this NRP.')
    Object.assign(p, { nrp, nama: data.nama.trim(), departemen: data.departemen.trim(), angkatan: data.angkatan.trim() })
    audit('admin', 'update_participant', pid)
    save()
  },

  async adminDeleteParticipant(pid) {
    await delay()
    requireAdmin()
    if (!db.participants.some((x) => x.id === pid)) throw new ApiError('not_found', 'Participant not found.')
    db.participants = db.participants.filter((x) => x.id !== pid)
    delete db.auth[pid]
    delete db.stamp4it[pid]
    db.visits = db.visits.filter((x) => x.participantId !== pid)
    db.resumes = db.resumes.filter((x) => x.participantId !== pid)
    db.answers = db.answers.filter((x) => x.participantId !== pid)
    db.submissions = db.submissions.filter((x) => x.participantId !== pid)
    for (const [k, s] of Object.entries(db.sessions)) if (s.role === 'participant' && s.subject === pid) delete db.sessions[k]
    audit('admin', 'delete_participant', pid)
    save()
  },

  async adminResetStaffPin(boothId) {
    await delay()
    requireAdmin()
    const pin = randomPin()
    db.staffPins[boothId] = hash(pin)
    for (const [k, s] of Object.entries(db.sessions)) if (s.role === 'staff' && s.boothId === boothId) delete db.sessions[k]
    audit('admin', 'reset_staff_pin', boothId)
    save()
    return pin
  },

  async adminResetStaffMasterPin() {
    await delay()
    requireAdmin()
    const pin = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
    db.staffMaster = hash(pin)
    for (const [k, s] of Object.entries(db.sessions)) if (s.role === 'staff' && s.subject.startsWith('runner')) delete db.sessions[k]
    audit('admin', 'reset_staff_master_pin', '')
    save()
    return pin
  },

  async adminUpsertBooth(b) {
    await delay()
    requireAdmin()
    const i = db.content.booths.findIndex((x) => x.id === b.id)
    if (i >= 0) db.content.booths[i] = b
    else db.content.booths.push(b)
    if (!db.staffPins[b.id]) db.staffPins[b.id] = hash(randomPin())
    save()
  },

  async adminUpsertSpeaker(s) {
    await delay()
    requireAdmin()
    const i = db.content.speakers.findIndex((x) => x.id === s.id)
    if (i >= 0) db.content.speakers[i] = s
    else db.content.speakers.push(s)
    save()
  },

  async adminDeleteSpeaker(id) {
    await delay()
    requireAdmin()
    db.content.speakers = db.content.speakers.filter((s) => s.id !== id)
    save()
  },

  async adminUpsertFacility(f) {
    await delay()
    requireAdmin()
    const i = db.content.facilities.findIndex((x) => x.id === f.id)
    if (i >= 0) db.content.facilities[i] = f
    else db.content.facilities.push(f)
    save()
  },

  async adminDeleteFacility(id) {
    await delay()
    requireAdmin()
    db.content.facilities = db.content.facilities.filter((f) => f.id !== id)
    save()
  },

  async adminUpsertQuestion(q) {
    await delay()
    requireAdmin()
    if (q.teks.trim().length < 3 || q.teks.length > 240) throw new ApiError('invalid', 'Question must be 3–240 characters.')
    const i = db.content.questions.findIndex((x) => x.id === q.id)
    if (i >= 0) db.content.questions[i] = q
    else db.content.questions.push(q)
    save()
  },

  async adminDeleteQuestion(id) {
    await delay()
    requireAdmin()
    db.content.questions = db.content.questions.filter((q) => q.id !== id)
    db.answers = db.answers.filter((a) => a.questionId !== id)
    audit('admin', 'delete_question', id)
    save()
  },

  async adminSetQuestionOrder(ids) {
    await delay()
    requireAdmin()
    ids.forEach((id, i) => {
      const q = db.content.questions.find((x) => x.id === id)
      if (q) q.sort = i + 1
    })
    save()
  },

  async adminSetSettings(s) {
    await delay()
    requireAdmin()
    Object.assign(db.content.settings, s)
    audit('admin', 'settings', JSON.stringify(s))
    save()
  },

  async adminExport(): Promise<ExportData> {
    await delay()
    requireAdmin()
    return buildExport(
      {
        participants: db.participants.map((p) => ({ id: p.id, nrp: p.nrp, nama: p.nama, departemen: p.departemen, angkatan: p.angkatan, hasPhoto: !!p.photo, createdAt: p.createdAt })),
        visits: db.visits.map((v) => ({ participantId: v.participantId, boothId: v.boothId, confirmedAt: v.confirmedAt, cancelledAt: v.cancelledAt })),
        resumes: db.resumes.map((r) => ({ participantId: r.participantId, boothId: r.boothId, poin: r.poin })),
        answers: db.answers.map((a) => ({ participantId: a.participantId, questionId: a.questionId, nilaiInt: a.nilaiInt, nilaiTeks: a.nilaiTeks })),
        submissions: db.submissions.map((x) => ({ participantId: x.participantId, version: x.version, status: x.status, submittedAt: x.submittedAt })),
        stamp4it: Object.entries(db.stamp4it).filter(([, v]) => v.given).map(([k]) => k),
      },
      { ...db.content, departemen: DEPARTEMEN_ITS },
    )
  },

  async uploadContentImage(file) {
    requireAdmin()
    return blobToDataUrl(file)
  },
}

// ---------------------------------------------------------------------------
// Dev-panel helpers (mock only)
// ---------------------------------------------------------------------------

let devScanCursor = 0

export const mockDev = {
  /** Simulates a booth officer confirming the logged-in participant. */
  confirmCurrent(boothId: string): string {
    const p = requireParticipant()
    if (activeVisits(p.id).some((v) => v.boothId === boothId)) return 'Already stamped.'
    const at = nowIso()
    db.visits.push({ id: rid(8), participantId: p.id, boothId, scannedAt: at, confirmedAt: at, confirmedBy: `staff-${boothId}`, cancelledAt: null })
    save()
    return 'Confirmed.'
  },

  fillResumes(): void {
    const p = requireParticipant()
    const sample = [
      'Start preparing the documents one full semester ahead.',
      'Adapting to the academic culture matters more than the language.',
      'The alumni network helps a lot when you first arrive.',
    ] as [string, string, string]
    for (const v of activeVisits(p.id)) {
      const row = db.resumes.find((r) => r.participantId === p.id && r.boothId === v.boothId)
      if (row) Object.assign(row, { poin: sample, updatedAt: nowIso() })
      else db.resumes.push({ participantId: p.id, boothId: v.boothId, poin: sample, updatedAt: nowIso() })
    }
    save()
  },

  /** Adds N dummy participants with mixed progress so admin & scanner have data. */
  seedDummies(n = 12): void {
    const names = ['Test Participant', 'Demo Student', 'Exchange Hopeful']
    const booths = db.content.booths
    for (let i = 0; i < n; i++) {
      const id = rid(8)
      const nrp = `50252400${String(30 + db.participants.length).padStart(2, '0')}`
      db.participants.push({
        id,
        nrp,
        nama: `${names[i % names.length]} ${db.participants.length + 1}`,
        departemen: DEPARTEMEN_ITS[(i * 7) % DEPARTEMEN_ITS.length],
        angkatan: String(2022 + (i % 4)),
        photo: null,
        createdAt: nowIso(),
      })
      db.auth[id] = { pinHash: hash('1234'), failed: 0, lockedUntil: 0, qrToken: rid(12) }
      const k = i % 5 === 0 ? 2 : 4
      const rotated = [...booths.slice(i % booths.length), ...booths.slice(0, i % booths.length)]
      rotated.slice(0, k).forEach((b, j) => {
        const at = new Date(nowMs() - (60 - j * 10) * 60000).toISOString()
        db.visits.push({ id: rid(8), participantId: id, boothId: b.id, scannedAt: at, confirmedAt: at, confirmedBy: `staff-${b.id}`, cancelledAt: null })
        db.resumes.push({
          participantId: id,
          boothId: b.id,
          poin: [
            `The first takeaway from the ${b.nama} booth was clear.`,
            `The speaker explained the selection process very clearly.`,
            `I want to try a similar program next year.`,
          ],
          updatedAt: at,
        })
      })
      if (k === 4) {
        db.content.questions.forEach((q, k) => {
          if (q.tipe === 'skala_1_5') db.answers.push({ participantId: id, questionId: q.id, nilaiInt: 3 + ((i + k) % 3), nilaiTeks: null })
          else if (q.wajib || i % 2 === 0) db.answers.push({ participantId: id, questionId: q.id, nilaiInt: null, nilaiTeks: 'Add a longer Q&A session.' })
        })
        db.submissions.push({
          id: rid(8),
          participantId: id,
          version: 1,
          status: i % 4 === 3 ? 'approved' : 'submitted',
          submittedAt: new Date(nowMs() - i * 60000).toISOString(),
          reviewedAt: null,
          reviewerNote: null,
        })
      }
    }
    save()
  },

  /** Token of a random participant who is not yet stamped at this booth — feeds the scanner demo. */
  randomToken(boothId: string): string | null {
    const pool = db.participants.filter((p) => !activeVisits(p.id).some((v) => v.boothId === boothId))
    const p = pool[devScanCursor++ % Math.max(1, pool.length)]
    return p ? `FS2:${db.auth[p.id].qrToken}` : null
  },

  setSimulation(on: boolean): void {
    db.content.settings.simulationMode = on
    save()
  },

  settings() {
    return db.content.settings
  },

  reset(): void {
    db = freshDb()
    for (const k of Object.keys(localStorage)) if (k.startsWith('fs2.')) localStorage.removeItem(k)
    save()
  },
}
