export type BoothId = string

export interface Point {
  x: number
  y: number
}

export interface Booth {
  id: BoothId
  slug: string
  nama: string
  region: string
  /** small stamp image url (null = generic FS² stamp) */
  stamp: string | null
  x: number
  y: number
  placeholderPos: boolean
  sort: number
}

export interface Speaker {
  id: string
  boothId: BoothId
  nama: string
  universitas: string
  program: string
  foto: string | null
  cerita: string
  placeholder: boolean
}

export interface Facility {
  id: string
  jenis: string
  label: string
  x: number | null
  y: number | null
  placeholder: boolean
  catatan?: string
}

export interface Question {
  id: string
  teks: string
  tipe: 'skala_1_5' | 'teks'
  wajib: boolean
  sort: number
  /** heading shown above the question (a group of questions shares one) */
  section?: string | null
  /** end labels of a 1–5 scale, e.g. "Poor" / "Excellent" */
  labelLow?: string | null
  labelHigh?: string | null
}

export interface RoomLabel {
  label: string
  x: number
  y: number
  sorot?: boolean
  batas?: { x: number; y: number; w: number; h: number }
  pintu_masuk?: Point
}

export interface EventInfo {
  nama: string
  tagline: string
  tanggal: string
  jam_acara: string
  tempat: string
  kontak_bantuan: { nama: string; wa: string }[]
  rundown: { jam: string; acara: string }[]
}

export interface Settings {
  simulationMode: boolean
  sessionStart: string // ISO with +07:00
  sessionEnd: string
  deadline: string
}

export interface Rules {
  jumlah_booth_wajib: number
  poin_per_resume: number
  min_kata_per_poin: number
}

export interface Content {
  event: EventInfo
  booths: Booth[]
  speakers: Speaker[]
  facilities: Facility[]
  questions: Question[]
  rooms: RoomLabel[]
  settings: Settings
  rules: Rules
  departemen: string[]
}

export interface VisitInfo {
  id: string
  boothId: BoothId
  confirmedAt: string
}

export interface ResumeInfo {
  boothId: BoothId
  poin: [string, string, string]
  updatedAt: string
}

export type SubmissionStatus = 'submitted' | 'revision' | 'approved'

export interface SubmissionInfo {
  id: string
  code: string
  version: number
  status: SubmissionStatus
  submittedAt: string
  reviewedAt: string | null
  reviewerNote: string | null
}

export interface Answer {
  questionId: string
  nilaiInt: number | null
  nilaiTeks: string | null
}

export interface MyState {
  participant: {
    id: string
    nama: string
    /** the participant's own full NRP (older cached states only have the masked one) */
    nrp?: string
    nrpMasked: string
    nrpLast4: string
    departemen: string
    angkatan: string
    photo: string | null
  }
  qrToken: string
  visits: VisitInfo[]
  resumes: ResumeInfo[]
  answers: Answer[]
  submission: SubmissionInfo | null
  stamp4it: boolean
  serverNow: string
}

export interface RegisterInput {
  nrp: string
  nama: string
  departemen: string
  angkatan: string
  pin: string
}

/** Scanner queue entry resolved by the server */
export interface ResolvedToken {
  token: string
  kind: 'ok' | 'duplicate' | 'unknown'
  participantId?: string
  nama?: string
  nrpMasked?: string
  photo?: string | null
}

export interface StaffHistoryItem {
  visitId: string
  participantId: string
  nama: string
  nrpMasked: string
  photo: string | null
  confirmedAt: string
}

export interface StaffSession {
  boothId: BoothId
  boothNama: string
}

export interface AdminDashboard {
  participants: number
  withPhoto: number
  perBooth: { boothId: BoothId; nama: string; count: number }[]
  allFour: number
  submissions: { submitted: number; revision: number; approved: number }
  stamp4it: number
  recent: { nama: string; boothNama: string; at: string }[]
}

export interface AdminSubmissionRow {
  submissionId: string
  participantId: string
  code: string
  nama: string
  nrp: string
  status: SubmissionStatus
  version: number
  submittedAt: string
  boothCount: number
  departemen: string
  angkatan: string
  reviewerNote: string | null
  /** booths with a finished note set (counted only for stamped booths) */
  notesDone: number
  /** required feedback questions answered, and how many there are */
  feedbackDone: number
  feedbackRequired: number
  stamp4it: boolean
}

export interface AdminParticipantDetail {
  id: string
  nrp: string
  nama: string
  departemen: string
  angkatan: string
  photo: string | null
  createdAt: string
  visits: (VisitInfo & { confirmedBy: string })[]
  resumes: ResumeInfo[]
  answers: Answer[]
  submission: SubmissionInfo | null
  stamp4it: boolean
}

export interface AdminParticipantRow {
  id: string
  nrp: string
  nama: string
  departemen: string
  angkatan: string
  hasPhoto: boolean
  visits: number
  status: SubmissionStatus | null
  locked: boolean
  /** a PIN reset is open: the participant has not chosen the new PIN yet */
  resetPending: boolean
}

export interface ExportData {
  /** same columns as the committee's Google Form sheet */
  respons: (string | number)[][]
  /** stamps, the three notes per booth, review status and Stamp4It */
  catatan: (string | number)[][]
  kunjungan: (string | number)[][]
  peserta: (string | number)[][]
}

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export interface FeedbackSummaryItem {
  questionId: string
  /** answers given so far */
  n: number
  /** average of a 1–5 question (null when nobody answered or it is an open question) */
  avg: number | null
  /** how many gave 1, 2, 3, 4, 5 */
  dist: number[]
  /** latest written answers of an open question */
  texts: { nama: string; text: string }[]
}

export interface FeedbackSummary {
  /** participants who answered at least one question */
  respondents: number
  items: FeedbackSummaryItem[]
}
