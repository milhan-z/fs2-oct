import type { SupabaseClient } from '@supabase/supabase-js'
import type { Api } from './api'
import { ApiError, type Content, type MyState, type ResolvedToken, type StaffHistoryItem, type StaffSession } from './types'
import { DEPARTEMEN_ITS } from './seed'
import { buildExport, type ExportRaw } from './exportBuilder'
import { toEnglish } from './messages'

// ---------------------------------------------------------------------------
// Supabase backend. Tables are RLS-locked; everything goes through SECURITY DEFINER RPCs
// with an app session token, plus two Edge Functions for signed photo URLs.
// ---------------------------------------------------------------------------

const SESSION_P = 'fs2.session.participant'
const SESSION_ADMIN = 'fs2.session.admin'
const staffKey = (slug: string) => `fs2.session.staff.${slug}`

interface StoredStaff extends StaffSession {
  token: string
}

const changed = () => window.dispatchEvent(new Event('fs2-mock-change'))

function readStaff(slug: string): StoredStaff | null {
  try {
    return JSON.parse(localStorage.getItem(staffKey(slug)) ?? 'null') as StoredStaff | null
  } catch {
    return null
  }
}

export function supabaseAdapter(): Api {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.')
  // supabase-js loads on the first call, so it stays out of the first-paint bundle
  let sbPromise: Promise<SupabaseClient> | null = null
  const client = () => (sbPromise ??= import('@supabase/supabase-js').then((m) => m.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })))

  async function rpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
    let res
    try {
      res = await (await client()).rpc(fn, params)
    } catch {
      throw new ApiError('network', 'No connection. Try again in a moment.')
    }
    if (res.error) {
      const m = res.error.message ?? ''
      const i = m.indexOf(':')
      if (res.error.code === 'P0001' && i > 0) throw new ApiError(m.slice(0, i), toEnglish(m.slice(i + 1)))
      if (!res.error.code) throw new ApiError('network', 'No connection. Try again in a moment.')
      throw new ApiError('server', 'Server error. Please try again.')
    }
    return res.data as T
  }

  /** login-style RPCs answer {ok, token | error, message} instead of raising */
  function unwrap<T extends { ok: boolean; error?: string; message?: string }>(r: T): T {
    if (!r.ok) throw new ApiError(r.error ?? 'error', toEnglish(r.message ?? 'Failed.'))
    return r
  }

  const pToken = () => localStorage.getItem(SESSION_P) ?? ''
  const aToken = () => localStorage.getItem(SESSION_ADMIN) ?? ''
  const sToken = (slug: string) => {
    const s = readStaff(slug)
    if (!s) throw new ApiError('auth', 'Officer session expired. Enter the booth PIN again.')
    return s.token
  }

  // --- attendance photos: private bucket, short-lived signed URLs (cached) ---
  const photoCache = new Map<string, { url: string; exp: number }>()
  async function photoUrls(token: string, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
    const want = [...new Set(paths.filter((p): p is string => !!p))]
    const now = Date.now()
    const missing = want.filter((p) => (photoCache.get(p)?.exp ?? 0) < now)
    if (missing.length) {
      const { data } = await (await client()).functions.invoke<{ urls: Record<string, string> }>('photo-view-url', { body: { token, paths: missing } })
      for (const [p, u] of Object.entries(data?.urls ?? {})) photoCache.set(p, { url: u, exp: now + 25 * 60_000 })
    }
    return new Map(want.flatMap((p) => (photoCache.has(p) ? [[p, photoCache.get(p)!.url] as const] : [])))
  }
  async function withPhotos<T extends { photo?: string | null }>(token: string, rows: T[]): Promise<T[]> {
    const m = await photoUrls(token, rows.map((r) => r.photo)).catch(() => new Map<string, string>())
    return rows.map((r) => ({ ...r, photo: r.photo ? (m.get(r.photo) ?? null) : null }))
  }

  async function signedUpload(body: Record<string, unknown>, bucket: string, file: Blob, contentType: string) {
    const { data, error } = await (await client()).functions.invoke<{ path: string; uploadToken: string; publicUrl?: string; error?: string; message?: string }>('photo-upload-url', { body })
    if (error || !data?.path) throw new ApiError('upload', 'Could not prepare the upload. Please try again.')
    const up = await (await client()).storage.from(bucket).uploadToSignedUrl(data.path, data.uploadToken, file, { contentType })
    if (up.error) throw new ApiError('upload', 'Photo upload failed. Please try again.')
    return data
  }

  let contentCache: Content | null = null
  const getContent = async (): Promise<Content> => {
    const c = await rpc<Omit<Content, 'departemen'>>('get_content')
    contentCache = { ...c, departemen: DEPARTEMEN_ITS }
    return contentCache
  }

  return {
    mode: 'supabase',
    getContent,

    async checkNrp(nrp) {
      return { exists: await rpc<boolean>('check_nrp', { p_nrp: nrp.trim() }) }
    },

    async login(nrp, pin) {
      const r = unwrap(await rpc<{ ok: boolean; token: string }>('participant_login', { p_nrp: nrp.trim(), p_pin: pin }))
      localStorage.setItem(SESSION_P, r.token)
    },

    async register(input) {
      const r = unwrap(
        await rpc<{ ok: boolean; token: string }>('participant_register', {
          p_nrp: input.nrp.trim(),
          p_nama: input.nama,
          p_departemen: input.departemen,
          p_angkatan: input.angkatan,
          p_pin: input.pin,
        }),
      )
      localStorage.setItem(SESSION_P, r.token)
    },

    hasSession: () => !!localStorage.getItem(SESSION_P),
    logout: () => localStorage.removeItem(SESSION_P),

    async getMyState() {
      const st = await rpc<MyState>('get_my_state', { p_token: pToken() })
      const path = st.participant.photo
      if (path) {
        const m = await photoUrls(pToken(), [path]).catch(() => new Map<string, string>())
        // keep a non-null marker even if the signed URL failed, so the photo gate does not trigger
        st.participant.photo = m.get(path) ?? 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
      }
      return st
    },

    async uploadPhoto(file) {
      const d = await signedUpload({ token: pToken(), kind: 'attendance' }, 'attendance-photos', file, 'image/jpeg')
      await rpc('set_photo', { p_token: pToken(), p_path: d.path })
      photoCache.delete(d.path)
      changed()
      return (await photoUrls(pToken(), [d.path])).get(d.path) ?? ''
    },

    async saveResume(boothId, poin) {
      return rpc<string>('save_resume', { p_token: pToken(), p_booth: boothId, p_poin1: poin[0], p_poin2: poin[1], p_poin3: poin[2] })
    },

    async saveFeedback(answers) {
      await rpc('save_feedback', { p_token: pToken(), p_answers: answers })
    },

    async submit() {
      await rpc('submit', { p_token: pToken() })
      changed()
    },

    // --- staff ---------------------------------------------------------------
    async staffLogin(slug, pin) {
      const r = unwrap(await rpc<{ ok: boolean; token: string; boothId: string; boothNama: string }>('staff_login', { p_slug: slug, p_pin: pin }))
      const s: StoredStaff = { token: r.token, boothId: r.boothId, boothNama: r.boothNama }
      localStorage.setItem(staffKey(slug), JSON.stringify(s))
      return { boothId: s.boothId, boothNama: s.boothNama }
    },

    staffSession(slug) {
      const s = readStaff(slug)
      return s ? { boothId: s.boothId, boothNama: s.boothNama } : null
    },

    staffLogout: (slug) => localStorage.removeItem(staffKey(slug)),

    async staffResolveTokens(slug, tokens) {
      const t = sToken(slug)
      return withPhotos(t, await rpc<ResolvedToken[]>('staff_resolve_tokens', { p_token: t, p_tokens: tokens }))
    },

    async staffFindByLast4(slug, last4) {
      const t = sToken(slug)
      return withPhotos(t, await rpc<ResolvedToken[]>('staff_find_by_last4', { p_token: t, p_last4: last4 }))
    },

    async staffConfirmBatch(slug, ids) {
      const n = await rpc<number>('staff_confirm_batch', { p_token: sToken(slug), p_participant_ids: ids })
      changed()
      return n
    },

    async staffHistory(slug) {
      const t = sToken(slug)
      return withPhotos(t, await rpc<StaffHistoryItem[]>('staff_history', { p_token: t }))
    },

    async staffCancelVisit(slug, visitId) {
      await rpc('staff_cancel_visit', { p_token: sToken(slug), p_visit: visitId })
      changed()
    },

    // --- admin ---------------------------------------------------------------
    async adminLogin(password) {
      const r = unwrap(await rpc<{ ok: boolean; token: string }>('admin_login', { p_password: password }))
      localStorage.setItem(SESSION_ADMIN, r.token)
    },
    adminHasSession: () => !!localStorage.getItem(SESSION_ADMIN),
    adminLogout: () => localStorage.removeItem(SESSION_ADMIN),

    adminDashboard: () => rpc('admin_dashboard', { p_token: aToken() }),
    adminListSubmissions: (status, q) => rpc('admin_list_submissions', { p_token: aToken(), p_status: status, p_q: q.trim() }),

    async adminParticipantDetail(pid) {
      const d = await rpc<Awaited<ReturnType<Api['adminParticipantDetail']>>>('admin_participant_detail', { p_token: aToken(), p_pid: pid })
      const [withUrl] = await withPhotos(aToken(), [d])
      return withUrl
    },

    async adminReview(submissionId, action, note) {
      await rpc('admin_review', { p_token: aToken(), p_submission: submissionId, p_action: action, p_note: note })
      changed()
    },
    async adminSetStamp4it(pid, given) {
      await rpc('admin_set_stamp4it', { p_token: aToken(), p_pid: pid, p_given: given })
      changed()
    },
    adminListParticipants: (q) => rpc('admin_list_participants', { p_token: aToken(), p_q: q.trim() }),
    adminResetPin: (pid) => rpc<string>('admin_reset_pin', { p_token: aToken(), p_pid: pid }),
    adminResetStaffPin: (boothId) => rpc<string>('admin_reset_staff_pin', { p_token: aToken(), p_booth: boothId }),
    adminUpsertBooth: (b) => rpc('admin_upsert_booth', { p_token: aToken(), p_booth: b }),
    adminUpsertSpeaker: (s) => rpc('admin_upsert_speaker', { p_token: aToken(), p_speaker: s }),
    adminDeleteSpeaker: (id) => rpc('admin_delete_speaker', { p_token: aToken(), p_id: id }),
    adminUpsertFacility: (f) => rpc('admin_upsert_facility', { p_token: aToken(), p_facility: f }),
    adminDeleteFacility: (id) => rpc('admin_delete_facility', { p_token: aToken(), p_id: id }),
    adminUpsertQuestion: (q) => rpc('admin_upsert_question', { p_token: aToken(), p_question: q }),
    async adminSetSettings(s) {
      await rpc('admin_set_settings', { p_token: aToken(), p_settings: s })
      changed()
    },

    async adminExport() {
      const raw = await rpc<ExportRaw>('admin_export_raw', { p_token: aToken() })
      return buildExport(raw, contentCache ?? (await getContent()))
    },

    async uploadContentImage(file, ext) {
      const d = await signedUpload({ token: aToken(), kind: 'content', ext }, 'content', file, ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg')
      return d.publicUrl!
    },
  }
}
