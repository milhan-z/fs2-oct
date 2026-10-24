import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api } from '../data/api'
import type { MyState } from '../data/types'
import { progress, type Progress } from '../data/rules'
import { flushDrafts } from '../data/drafts'
import { useContent } from './providers'
import { useLive } from './useAsync'

interface Ctx {
  state: MyState | null
  prog: Progress | null
  reload: () => Promise<void>
  setState: (s: MyState | null) => void
}

const ParticipantCtx = createContext<Ctx>({ state: null, prog: null, reload: async () => {}, setState: () => {} })

const seenKey = (pid: string) => `fs2.seenStamps.${pid}`
const STATE_CACHE = 'fs2.cache.state'

function readStateCache(): MyState | null {
  try {
    const raw = localStorage.getItem(STATE_CACHE)
    return raw ? (JSON.parse(raw) as MyState) : null
  } catch {
    return null
  }
}

export function clearStateCache() {
  localStorage.removeItem(STATE_CACHE)
}

function readSeen(pid: string): string[] | null {
  try {
    const raw = localStorage.getItem(seenKey(pid))
    return raw ? (JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

export function markStampSeen(pid: string, boothId: string) {
  const seen = new Set(readSeen(pid) ?? [])
  seen.add(boothId)
  localStorage.setItem(seenKey(pid), JSON.stringify([...seen]))
}

/** Screens on which a new stamp interrupts with the stamp moment. */
const POLL_ROUTES = ['/map', '/qr', '/passport']

export function ParticipantProvider({ children }: { children: ReactNode }) {
  const { content } = useContent()
  const loc = useLocation()
  const nav = useNavigate()
  const polling = POLL_ROUTES.some((r) => loc.pathname.startsWith(r))
  const { data: state, reload, setData, error } = useLive(() => (api.hasSession() ? api.getMyState() : Promise.resolve(null)), [], polling ? 4000 : 0, api.hasSession() ? readStateCache() : null)

  // cache the last state so pages render at once on the next load (A3)
  useEffect(() => {
    if (state) localStorage.setItem(STATE_CACHE, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (error && (error as { code?: string }).code === 'auth') {
      api.logout()
      clearStateCache()
      setData(null)
      nav('/signin', { replace: true })
    }
  }, [error, nav, setData])

  // Sync resume drafts written while offline
  const pid = state?.participant.id
  useEffect(() => {
    if (!pid) return
    const flush = () => flushDrafts(pid).then((n) => void (n && reload()))
    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [pid, reload])

  // Detect freshly confirmed stamps → stamp moment (MOTION #4)
  useEffect(() => {
    if (!state) return
    const pid = state.participant.id
    const seen = readSeen(pid)
    if (!seen) {
      localStorage.setItem(seenKey(pid), JSON.stringify(state.visits.map((v) => v.boothId)))
      return
    }
    const fresh = state.visits.find((v) => !seen.includes(v.boothId))
    if (fresh && polling) {
      markStampSeen(pid, fresh.boothId)
      nav(`/stamp/${fresh.boothId}`)
    }
  }, [state, polling, nav])

  const prog = useMemo(() => (state && content ? progress(state, content) : null), [state, content])

  return <ParticipantCtx.Provider value={{ state, prog, reload, setState: setData }}>{children}</ParticipantCtx.Provider>
}

export function useParticipant() {
  return useContext(ParticipantCtx)
}

/** Signs the participant out of this phone and closes the passport. */
export function useSignOut() {
  const { setState } = useParticipant()
  const nav = useNavigate()
  return () => {
    if (!confirm('Sign out of the passport on this phone? You can sign in again with your NRP and PIN.')) return
    api.logout()
    clearStateCache()
    setState(null)
    nav('/', { replace: true })
  }
}
