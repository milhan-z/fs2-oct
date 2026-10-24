import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { Icon, StampImg } from '../../components/decor'
import { BackHeader, Loading, useOnline } from '../../components/ui'
import { api } from '../../data/api'
import { getDraft, setDraft } from '../../data/drafts'
import { poinOk, wordCount } from '../../data/rules'
import { fmtTime } from '../../data/time'

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error'

const PLACEHOLDERS = ['Something new you learned from the speaker', 'A tip or story that stuck with you', 'What do you want to try next?']

/** P7 — visa page + 3-point resume with debounced autosave and local drafts (MOTION #8). */
export function Visa() {
  const { boothId = '' } = useParams()
  const nav = useNavigate()
  const { content } = useContent()
  const { state, prog, reload } = useParticipant()
  const online = useOnline()
  const [poin, setPoin] = useState<[string, string, string] | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const timer = useRef<number>(0)
  const pid = state?.participant.id

  // init from the newer of local draft / server copy
  useEffect(() => {
    if (!state || poin) return
    const server = state.resumes.find((r) => r.boothId === boothId)
    const draft = getDraft(state.participant.id, boothId)
    const serverAt = server ? new Date(server.updatedAt).getTime() : 0
    if (draft && (draft.dirty || draft.at > serverAt)) {
      setPoin(draft.poin)
      setSave(draft.dirty ? 'pending' : 'saved')
    } else {
      setPoin(server?.poin ?? ['', '', ''])
      if (server) setSavedAt(server.updatedAt)
    }
  }, [state, boothId, poin])

  const push = async (p: [string, string, string]) => {
    if (!pid) return
    if (!navigator.onLine) return setSave('offline')
    setSave('saving')
    try {
      const at = await api.saveResume(boothId, p)
      setDraft(pid, boothId, p, false)
      setSavedAt(at)
      setSave('saved')
      reload()
    } catch (e) {
      setSave((e as { code?: string }).code === 'locked' ? 'error' : navigator.onLine ? 'error' : 'offline')
    }
  }

  // retry when connectivity returns
  useEffect(() => {
    if (online && (save === 'offline' || save === 'pending') && poin) push(poin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!content || !state || !prog || !poin) return <Loading />
  const booth = content.booths.find((b) => b.id === boothId)
  const visit = state.visits.find((v) => v.boothId === boothId)
  if (!booth || !visit) {
    return (
      <main className="screen-bg flex min-h-dvh flex-col">
        <BackHeader kicker="Visa" to="/passport" />
        <p className="p-6 text-muted">This booth is not stamped yet. Show your QR to the booth officer first.</p>
      </main>
    )
  }
  const speakers = content.speakers.filter((s) => s.boothId === boothId)
  const min = content.rules.min_kata_per_poin
  const okCount = poin.filter((p) => poinOk(p, min)).length
  const locked = prog.locked

  const change = (i: number, v: string) => {
    const next = [...poin] as [string, string, string]
    next[i] = v
    setPoin(next)
    setDraft(state.participant.id, boothId, next, true)
    setSave(navigator.onLine ? 'pending' : 'offline')
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => push(next), 1500)
  }

  const finish = async () => {
    clearTimeout(timer.current)
    const d = getDraft(state.participant.id, boothId)
    if (d?.dirty) await push(d.poin)
    nav('/passport')
  }

  const statusText: Record<SaveState, string> = {
    idle: savedAt ? `Saved · ${fmtTime(savedAt)}` : 'Nothing written yet',
    pending: 'Typing…',
    saving: 'Saving…',
    saved: `Autosaved · ${fmtTime(savedAt)}`,
    offline: 'Offline · draft kept on this phone, syncs when online',
    error: 'Could not save · draft kept on this phone',
  }
  const savedIcon = save === 'saved' || (save === 'idle' && savedAt)

  return (
    <main className="screen-bg flex min-h-dvh flex-col pb-5">
      <BackHeader kicker={`Visa · ${booth.nama} booth`} onBack={finish} />
      <div className="flex gap-3 px-5 pt-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] leading-tight font-extrabold text-white">{speakers.map((s) => s.nama).join(' & ') || booth.nama}</h1>
          {speakers[0] && (
            <p className="mt-1 text-[14px] leading-snug text-muted">
              {speakers[0].program} · {speakers[0].universitas}
            </p>
          )}
          <span className="tape mt-3 text-[14px]">Stamped {fmtTime(visit.confirmedAt)} · Lounge</span>
        </div>
        <StampImg src={booth.stamp} alt={`${booth.nama} stamp`} className="h-[88px] w-[88px] flex-none -rotate-6" />
      </div>

      <section className="relative mx-4 mt-6 rounded-[10px] bg-paper px-4 pt-5 pb-4 text-ink shadow-xl" aria-labelledby="resume-title">
        <span className="absolute -top-3 right-8 h-6 w-28 rotate-2 bg-yellow/85" aria-hidden="true" />
        <div className="flex items-baseline justify-between">
          <h2 id="resume-title" className="font-serif text-[16px] font-bold">
            {content.rules.poin_per_resume} things you learned
          </h2>
          <span className="text-[16px] font-extrabold text-red" aria-live="polite">
            {okCount}/{content.rules.poin_per_resume}
          </span>
        </div>
        {locked && <p className="mt-2 rounded-lg bg-[#efe6d6] px-3 py-2 text-[14px]">Submission sent — notes are locked.</p>}

        {poin.map((p, i) => {
          const ok = poinOk(p, min)
          const wc = wordCount(p)
          return (
            <div key={i} className="mt-4">
              <label htmlFor={`poin-${i}`} className={`flex items-center gap-1 text-[14px] font-bold ${ok ? 'text-[#2e7d32]' : ''}`}>
                Point {i + 1}
                <AnimatePresence>
                  {ok && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.2 }}>
                      <Icon.Check className="h-4 w-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="ml-auto text-[12px] font-normal text-[#7a7068]">{ok ? '' : `${wc}/${min} words`}</span>
              </label>
              <textarea
                id={`poin-${i}`}
                rows={3}
                readOnly={locked}
                value={p}
                placeholder={PLACEHOLDERS[i]}
                onChange={(e) => change(i, e.target.value)}
                className="field-paper mt-1.5 resize-none transition-colors"
                style={ok ? { borderColor: '#2e7d32', borderWidth: 2 } : undefined}
              />
            </div>
          )
        })}

        <p className={`mt-3 flex items-center gap-1.5 text-[14px] ${save === 'offline' || save === 'error' ? 'text-[#a15c00]' : 'text-[#2e7d32]'}`} role="status">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={savedIcon ? 'check' : 'cloud'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.2 }}>
              {savedIcon ? <Icon.Check className="h-4 w-4" /> : <Icon.Cloud className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
          {statusText[save]}
        </p>
      </section>

      <div className="mt-auto px-5 pt-6">
        <button type="button" onClick={finish} className="btn btn-red w-full">
          Done
        </button>
      </div>
    </main>
  )
}
