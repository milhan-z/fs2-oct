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
const STAFF_ROAM = 'fs2.session.staffAll'

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
  // Plain fetch against PostgREST / Edge Functions / Storage: no client library to download before
  // the first call, so the first request leaves as soon as the app boots.
  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  async function post(path: string, body: unknown): Promise<Response> {
    try {
      return await fetch(`${url}${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } catch {
      throw new ApiError('network', 'No connection. Try again in a moment.')
    }
  }

  async function rpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
    const res = await post(`/rest/v1/rpc/${fn}`, params)
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok) {
      const m: string = data?.message ?? ''
      const i = m.indexOf(':')
      if (data?.code === 'P0001' && i > 0) throw new ApiError(m.slice(0, i), toEnglish(m.slice(i + 1)))
      throw new ApiError('server', 'Server error. Please try again.')
    }
    return data as T
  }

  async function invoke<T>(fn: string, body: unknown): Promise<T | null> {
    const res = await post(`/functions/v1/${fn}`, body)
    return res.ok ? ((await res.json()) as T) : null
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

  // --- attendance photos: private bucket, short-lived signed URLs (cached across reloads) ---
  const PHOTO_CACHE = 'fs2.cache.photoUrls'
  let early: { at: number; p: Promise<UploadSlot | null> } | null = null
  const photoCache = new Map<string, { url: string; exp: number; local?: boolean }>(
    (() => {
      try {
        return Object.entries(JSON.parse(localStorage.getItem(PHOTO_CACHE) ?? '{}') as Record<string, { url: string; exp: number }>).filter(([, v]) => v.exp > Date.now())
      } catch {
        return []
      }
    })(),
  )
  const persistPhotos = () => {
    try {
      // pictures that only exist in this page (blob URLs) must not outlive it
      localStorage.setItem(PHOTO_CACHE, JSON.stringify(Object.fromEntries([...photoCache].filter(([, v]) => v.exp > Date.now() && !v.local).slice(-300))))
    } catch {
      /* storage full — the in-memory cache still works */
    }
  }
  async function photoUrls(token: string, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
    const want = [...new Set(paths.filter((p): p is string => !!p))]
    const now = Date.now()
    const missing = want.filter((p) => (photoCache.get(p)?.exp ?? 0) < now)
    if (missing.length) {
      const data = await invoke<{ urls: Record<string, string> }>('photo-view-url', { token, paths: missing })
      for (const [p, u] of Object.entries(data?.urls ?? {})) photoCache.set(p, { url: u, exp: now + 25 * 60_000 })
      persistPhotos()
    }
    return new Map(want.flatMap((p) => (photoCache.has(p) ? [[p, photoCache.get(p)!.url] as const] : [])))
  }
  const PHOTO_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
  const photoBusy = new Map<string, number>() // path → time of the last attempt (no retry storms)
  function resolvePhotoInBackground(token: string, path: string) {
    if (Date.now() - (photoBusy.get(path) ?? 0) < 20_000) return
    photoBusy.set(path, Date.now())
    photoUrls(token, [path])
      .then(async () => {
        const hit = photoCache.get(path)
        if (!hit) return
        // decode the picture first, so it fades in from memory instead of loading after the swap
        const img = new Image()
        img.src = hit.url
        await img.decode().catch(() => {})
        changed()
      })
      .catch(() => {})
  }
  async function withPhotos<T extends { photo?: string | null }>(token: string, rows: T[]): Promise<T[]> {
    const m = await photoUrls(token, rows.map((r) => r.photo)).catch(() => new Map<string, string>())
    return rows.map((r) => ({ ...r, photo: r.photo ? (m.get(r.photo) ?? null) : null }))
  }

  type UploadSlot = { path: string; uploadToken: string; publicUrl?: string; error?: string; message?: string }
  async function signedUpload(body: Record<string, unknown>, bucket: string, file: Blob, contentType: string, early?: Promise<UploadSlot | null>) {
    let data = early ? await early : null
    if (!data?.path) data = await invoke<UploadSlot>('photo-upload-url', body)
    if (!data?.path) throw new ApiError('upload', 'Could not prepare the upload. Please try again.')
    // same request supabase-js storage.uploadToSignedUrl() makes
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', new Blob([file], { type: contentType }))
    const target = `${url}/storage/v1/object/upload/sign/${bucket}/${data.path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(data.uploadToken)}`
    const up = await fetch(target, { method: 'PUT', headers: { ...headers, 'x-upsert': 'false' }, body: form }).catch(() => null)
    if (!up?.ok) throw new ApiError('upload', 'Photo upload failed. Please try again.')
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
      return rpc<{ exists: boolean; reset: boolean }>('participant_status', { p_nrp: nrp.trim() })
    },

    async login(nrp, pin) {
      const r = unwrap(await rpc<{ ok: boolean; token: string; photo?: string | null }>('participant_login', { p_nrp: nrp.trim(), p_pin: pin }))
      localStorage.setItem(SESSION_P, r.token)
      // the photo URL is fetched while the passport state loads, not after it
      if (r.photo) resolvePhotoInBackground(r.token, r.photo)
    },

    async setPin(nrp, pin) {
      const r = unwrap(await rpc<{ ok: boolean; token: string; photo?: string | null }>('participant_set_pin', { p_nrp: nrp.trim(), p_pin: pin }))
      localStorage.setItem(SESSION_P, r.token)
      if (r.photo) resolvePhotoInBackground(r.token, r.photo)
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
        // The state must not wait for the signed photo URL (a second round trip). Use the cached URL if there is
        // one, otherwise a non-null placeholder (so the photo gate does not trigger) and fetch the URL in the
        // background; the app refreshes once when it arrives and the picture fades in.
        const hit = photoCache.get(path)
        if (hit && hit.exp > Date.now()) st.participant.photo = hit.url
        else {
          st.participant.photo = PHOTO_PLACEHOLDER
          resolvePhotoInBackground(pToken(), path)
        }
      }
      return st
    },

    // The Edge Function that hands out the signed upload URL can start cold (seconds), so it is called as soon as the
    // camera opens; by the time the photo is accepted the URL is usually ready.
    prepareUpload() {
      if (early && Date.now() - early.at < 10 * 60_000) return
      early = { at: Date.now(), p: invoke<UploadSlot>('photo-upload-url', { token: pToken(), kind: 'attendance' }).catch(() => null) }
    },

    async uploadPhoto(file) {
      const pre = early && Date.now() - early.at < 10 * 60_000 ? early.p : undefined
      early = null
      const d = await signedUpload({ token: pToken(), kind: 'attendance' }, 'attendance-photos', file, 'image/jpeg', pre)
      await rpc('set_photo', { p_token: pToken(), p_path: d.path })
      // the picture is already on this phone: show it right away instead of waiting for a signed view URL
      const local = URL.createObjectURL(file)
      photoCache.set(d.path, { url: local, exp: Date.now() + 20 * 60_000, local: true })
      changed()
      return local
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
      const r = unwrap(await rpc<{ ok: boolean; roaming: boolean; token: string; boothId?: string; boothNama?: string }>('staff_login', { p_slug: slug, p_pin: pin }))
      if (r.roaming) localStorage.setItem(STAFF_ROAM, r.token)
      if (!r.boothId || !r.boothNama) return null
      const s: StoredStaff = { token: r.token, boothId: r.boothId, boothNama: r.boothNama }
      localStorage.setItem(staffKey(slug), JSON.stringify(s))
      return { boothId: s.boothId, boothNama: s.boothNama }
    },

    staffSession(slug) {
      const s = readStaff(slug)
      return s ? { boothId: s.boothId, boothNama: s.boothNama } : null
    },

    staffCanSwitch: () => !!localStorage.getItem(STAFF_ROAM),

    async staffSwitch(slug) {
      const roam = localStorage.getItem(STAFF_ROAM)
      if (!roam) throw new ApiError('auth', 'Sign in with the staff PIN first.')
      try {
        const r = await rpc<{ token: string; boothId: string; boothNama: string }>('staff_switch', { p_token: roam, p_slug: slug })
        localStorage.setItem(staffKey(slug), JSON.stringify({ token: r.token, boothId: r.boothId, boothNama: r.boothNama } satisfies StoredStaff))
        return { boothId: r.boothId, boothNama: r.boothNama }
      } catch (e) {
        if ((e as ApiError).code === 'auth') localStorage.removeItem(STAFF_ROAM)
        throw e
      }
    },

    staffLogout: () => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('fs2.session.staff')) localStorage.removeItem(k)
    },

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
    adminResetStaffMasterPin: () => rpc<string>('admin_reset_staff_master_pin', { p_token: aToken() }),
    adminResetPin: (pid) => rpc<void>('admin_reset_pin', { p_token: aToken(), p_pid: pid }),
    adminUpdateParticipant: (pid, data) => rpc<void>('admin_update_participant', { p_token: aToken(), p_pid: pid, p_data: data }),
    adminDeleteParticipant: (pid) => rpc<void>('admin_delete_participant', { p_token: aToken(), p_pid: pid }),
    adminResetStaffPin: (boothId) => rpc<string>('admin_reset_staff_pin', { p_token: aToken(), p_booth: boothId }),
    adminUpsertBooth: (b) => rpc('admin_upsert_booth', { p_token: aToken(), p_booth: b }),
    adminUpsertSpeaker: (s) => rpc('admin_upsert_speaker', { p_token: aToken(), p_speaker: s }),
    adminDeleteSpeaker: (id) => rpc('admin_delete_speaker', { p_token: aToken(), p_id: id }),
    adminUpsertFacility: (f) => rpc('admin_upsert_facility', { p_token: aToken(), p_facility: f }),
    adminDeleteFacility: (id) => rpc('admin_delete_facility', { p_token: aToken(), p_id: id }),
    adminUpsertQuestion: (q) => rpc('admin_upsert_question', { p_token: aToken(), p_question: q }),
    adminDeleteQuestion: (id) => rpc('admin_delete_question', { p_token: aToken(), p_id: id }),
    adminSetQuestionOrder: (ids) => rpc('admin_set_question_order', { p_token: aToken(), p_ids: ids }),
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
