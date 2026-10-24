import type {
  AdminDashboard,
  AdminParticipantDetail,
  AdminParticipantRow,
  AdminSubmissionRow,
  Answer,
  Booth,
  Content,
  ExportData,
  Facility,
  MyState,
  Question,
  RegisterInput,
  ResolvedToken,
  Settings,
  Speaker,
  StaffHistoryItem,
  StaffSession,
  SubmissionStatus,
} from './types'
import { mockAdapter } from './mockAdapter'
import { supabaseAdapter } from './supabaseAdapter'

/**
 * Single data interface for the whole app. Two adapters implement it:
 * `mock` (in-memory + localStorage, for demos) and `supabase` (RPC-only backend).
 */
export interface Api {
  mode: 'mock' | 'supabase'
  getContent(): Promise<Content>

  // participant
  checkNrp(nrp: string): Promise<{ exists: boolean }>
  login(nrp: string, pin: string): Promise<void>
  register(input: RegisterInput): Promise<void>
  hasSession(): boolean
  logout(): void
  getMyState(): Promise<MyState>
  uploadPhoto(file: Blob): Promise<string>
  saveResume(boothId: string, poin: [string, string, string]): Promise<string>
  saveFeedback(answers: Answer[]): Promise<void>
  submit(): Promise<void>

  // staff
  staffLogin(slug: string, pin: string): Promise<StaffSession>
  staffSession(slug: string): StaffSession | null
  staffLogout(slug: string): void
  staffResolveTokens(slug: string, tokens: string[]): Promise<ResolvedToken[]>
  staffFindByLast4(slug: string, last4: string): Promise<ResolvedToken[]>
  staffConfirmBatch(slug: string, participantIds: string[]): Promise<number>
  staffHistory(slug: string): Promise<StaffHistoryItem[]>
  staffCancelVisit(slug: string, visitId: string): Promise<void>

  // admin
  adminLogin(password: string): Promise<void>
  adminHasSession(): boolean
  adminLogout(): void
  adminDashboard(): Promise<AdminDashboard>
  adminListSubmissions(status: SubmissionStatus, q: string): Promise<AdminSubmissionRow[]>
  adminParticipantDetail(participantId: string): Promise<AdminParticipantDetail>
  adminReview(submissionId: string, action: 'approve' | 'revision', note: string): Promise<void>
  adminSetStamp4it(participantId: string, given: boolean): Promise<void>
  adminListParticipants(q: string): Promise<AdminParticipantRow[]>
  /** returns the new PIN — shown once to the admin */
  adminResetPin(participantId: string): Promise<string>
  /** returns the new staff PIN — shown once */
  adminResetStaffPin(boothId: string): Promise<string>
  adminUpsertBooth(b: Booth): Promise<void>
  adminUpsertSpeaker(s: Speaker): Promise<void>
  adminDeleteSpeaker(id: string): Promise<void>
  adminUpsertFacility(f: Facility): Promise<void>
  adminDeleteFacility(id: string): Promise<void>
  adminUpsertQuestion(q: Question): Promise<void>
  adminSetSettings(s: Partial<Settings>): Promise<void>
  adminExport(): Promise<ExportData>
  /** stamp / speaker photo upload (admin) — returns a URL usable in <img> */
  uploadContentImage(file: Blob, ext: 'jpg' | 'png' | 'webp'): Promise<string>
}

export const api: Api = import.meta.env.VITE_DATA_MODE === 'supabase' ? supabaseAdapter() : mockAdapter

export const isMock = api.mode === 'mock'
