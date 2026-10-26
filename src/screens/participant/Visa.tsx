import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { useOnline } from '../../components/ui'
import { api } from '../../data/api'
import { getDraft, setDraft } from '../../data/drafts'
import { poinOk, wordCount } from '../../data/rules'
import { fmtTime } from '../../data/time'
import { sfx, vibrate } from '../../app/sound'
import { InkIcon } from '../../booklet/icons'
import { DocLabel, Folio, InkStamp, PageNo, PageSkeleton, Tape } from '../../booklet/print'

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error'

const PLACEHOLDERS = ['Something new you learned from the speaker', 'A tip or story that stuck with you', 'What do you want to try next?']

/**
 * P5 + P7 — one visa page per booth (E1). When the officer confirms, the stamp lands right here
 * (MOTION #4) and the three note lines sit under it: write now, or come back later — every line
 * autosaves to this page (debounced) and to a local draft while offline (MOTION #8).
 */
export function Visa({ boothId, stampMode, onClose }: { boothId: string; stampMode: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state, prog, reload } = useParticipant()
  const online = useOnline()
  const [poin, setPoin] = useState<[string, string, string] | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const timer = useRef<number>(0)
  const pid = state?.participant.id
  const [paper, animatePaper] = useAnimate()
  const [landed, setLanded] = useState(!stampMode || !!reduce)
  const [moment] = useState(stampMode) // stays true for this visit of the page, even after "Write now"
  const firstLine = useRef<HTMLTextAreaElement>(null)

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

  // the stamp lands: one press, ink, the page shakes twice
  useEffect(() => {
    if (!stampMode || reduce) return
    const t = setTimeout(async () => {
      setLanded(true)
      sfx.thunk()
      vibrate(80)
      if (paper.current) await animatePaper(paper.current, { x: [0, -3, 3, -3, 3, 0] }, { duration: 0.28 })
    }, 650)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  useEffect(() => {
    if (online && (save === 'offline' || save === 'pending') && poin) push(poin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!content || !state || !prog || !poin) return <PageSkeleton />
  const booth = content.booths.find((b) => b.id === boothId)
  if (!booth) return <PageSkeleton />
  const visit = state.visits.find((v) => v.boothId === boothId)
  const speakers = content.speakers.filter((s) => s.boothId === boothId)
  const min = content.rules.min_kata_per_poin
  const okCount = poin.filter((p) => poinOk(p, min)).length
  const locked = prog.locked
  const total = prog.required
  const no = String(booth.sort).padStart(2, '0')

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
    onClose()
  }

  const writeNow = () => {
    nav(`/visa/${booth.id}`, { replace: true })
    setTimeout(() => {
      firstLine.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      firstLine.current?.focus({ preventScroll: true })
    }, 60)
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
    <div className="relative flex min-h-full flex-col px-6 pt-3 pb-12">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Close" onClick={finish} className="-ml-3 flex h-11 w-11 items-center justify-center text-ink/80">
          <InkIcon.Close className="h-5 w-5" />
        </button>
        <Folio left={`Visa · ${booth.nama} booth`} serial={no} className="min-w-0 flex-1" />
      </div>

      {/* the visa: thin printed double frame; the stamp lands inside */}
      <motion.section ref={paper} className="relative mt-4 border-[3px] border-double border-ink/30 px-4 pt-4 pb-5" aria-label={`${booth.nama} visa`}>
        {moment && (
          <div className="mb-3">
            <p className="font-mono text-[11px] tracking-[0.2em] text-[#8a5a12] uppercase">Entry approved</p>
            <AnimatePresence>
              {landed && (
                <motion.h2
                  className="mt-1 font-serif text-[30px] leading-[34px] font-bold text-stamp"
                  style={{ textShadow: '0 0 14px rgba(232,32,32,.35)' }}
                  initial={reduce ? { opacity: 0 } : { opacity: 0 }}
                  animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 0.35, 1, 0.6, 1] }}
                  transition={{ duration: 0.7 }}
                >
                  Passport stamped!
                </motion.h2>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* the stamp lands in the middle of the visa */}
        <div className="relative mx-auto h-[136px] w-[136px]">
          {/* ink-landing glow (one of the two allowed glows) */}
          <AnimatePresence>
            {moment && landed && !reduce && (
              <motion.span className="absolute inset-0 rounded-full bg-[#e82020]" initial={{ opacity: 0.45, scale: 0.8 }} animate={{ opacity: 0, scale: 1.4 }} transition={{ duration: 0.5 }} aria-hidden="true" />
            )}
          </AnimatePresence>
          <motion.div
            initial={moment && !reduce ? { y: -260, scale: 1.6, opacity: 0, filter: 'blur(3px)' } : false}
            animate={moment && !landed ? {} : { y: 0, scale: [1.6, 0.94, 1], opacity: 1, filter: 'blur(0px)' }}
            transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 500, damping: 28 }}
          >
            <InkStamp src={booth.stamp} seed={booth.id} size={136} alt={`${booth.nama} stamp`} pending={!visit} large />
          </motion.div>
        </div>
        {visit && (
          <div className="mt-2 text-center">
            <Tape className="font-mono">Stamped {fmtTime(visit.confirmedAt)} · Lounge</Tape>
          </div>
        )}

        <h1 className="mt-5 font-serif text-[24px] leading-[29px] font-bold">{speakers.map((s) => s.nama).join(' & ') || booth.nama}</h1>
        {speakers[0] && (
          <p className="mt-1.5 text-[14px] leading-snug text-ink/70">
            {speakers[0].program} · {speakers[0].universitas}
          </p>
        )}

        {moment && landed && stampMode && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.5, duration: 0.25 }}>
            <p className="mt-5 text-[15px] leading-[22px] text-ink/75">
              {Math.min(prog.stampCount, total)} of {total} visas stamped{content.booths.length > total ? ' (any booths count)' : ''}. Write your notes now, or come back to this page later.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <motion.button type="button" whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} onClick={writeNow} className="btn btn-line flex-1">
                Write now
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} onClick={() => nav('/map')} className="btn btn-primary flex-1">
                {prog.stampCount >= total ? 'Back to map' : 'Next booth'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </motion.section>

      {/* notes written on the visa page (E1) */}
      {visit ? (
        <section className="mt-8" aria-labelledby="resume-title">
          <div className="flex items-baseline justify-between">
            <h2 id="resume-title" className="font-serif text-[20px] font-bold">
              {content.rules.poin_per_resume} things you brought back
            </h2>
            <span className="font-mono text-[16px] font-bold text-stamp" aria-live="polite">
              {okCount}/{content.rules.poin_per_resume}
            </span>
          </div>
          {locked && <p className="mt-2 text-[14px] text-ink/70 italic">Submission sent — notes are locked.</p>}

          {poin.map((p, i) => {
            const ok = poinOk(p, min)
            const wc = wordCount(p)
            return (
              <div key={i} className="mt-5">
                <div className="flex items-center gap-1.5">
                  <DocLabel htmlFor={`poin-${i}`} className={ok ? '!text-[#2e7d32]' : ''}>
                    Point {i + 1}
                  </DocLabel>
                  {ok && <InkIcon.Check className="h-3.5 w-3.5 text-[#2e7d32]" />}
                  <span className="ml-auto font-mono text-[12px] text-ink/50">{ok ? '' : `${wc}/${min} words`}</span>
                </div>
                <textarea
                  ref={i === 0 ? firstLine : undefined}
                  id={`poin-${i}`}
                  rows={3}
                  readOnly={locked}
                  value={p}
                  placeholder={PLACEHOLDERS[i]}
                  onChange={(e) => change(i, e.target.value)}
                  className="ruled mt-1"
                />
              </div>
            )
          })}

          <p className={`mt-3 flex items-center gap-1.5 text-[13px] ${save === 'offline' || save === 'error' ? 'text-[#8a5a12]' : 'text-[#2e7d32]'}`} role="status">
            {savedIcon ? <InkIcon.Check className="h-4 w-4" /> : <InkIcon.Cloud className="h-4 w-4" />}
            {statusText[save]}
          </p>

          <div className="mt-8">
            <motion.button type="button" whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} onClick={finish} className="btn btn-primary w-full">
              Done
            </motion.button>
          </div>
        </section>
      ) : (
        <p className="mt-6 text-[15px] text-ink/70">This visa is still waiting for its stamp. Show your QR permit to the booth officer first.</p>
      )}
      <PageNo n={4 + booth.sort} />
    </div>
  )
}
