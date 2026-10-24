import { api } from './api'

// Local resume drafts: written on every keystroke, synced (debounced) to the server.
// A draft stays "dirty" until the server confirms, so nothing is lost offline or on refresh.

export interface Draft {
  poin: [string, string, string]
  at: number
  dirty: boolean
}

const key = (pid: string, boothId: string) => `fs2.draft.${pid}.${boothId}`

export function getDraft(pid: string, boothId: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(pid, boothId))
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

export function setDraft(pid: string, boothId: string, poin: [string, string, string], dirty: boolean) {
  try {
    localStorage.setItem(key(pid, boothId), JSON.stringify({ poin, at: Date.now(), dirty }))
  } catch {
    /* storage full — server copy still exists */
  }
}

/** Push every dirty draft of this participant. Returns how many were synced. */
export async function flushDrafts(pid: string): Promise<number> {
  let n = 0
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(`fs2.draft.${pid}.`)) continue
    const boothId = k.split('.').pop()!
    const d = getDraft(pid, boothId)
    if (!d?.dirty) continue
    try {
      await api.saveResume(boothId, d.poin)
      setDraft(pid, boothId, d.poin, false)
      n++
    } catch {
      /* stays dirty; retried on next flush */
    }
  }
  return n
}
