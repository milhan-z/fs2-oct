import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { Icon } from '../../components/decor'
import { BackHeader, ErrorText, Loading, Spinner } from '../../components/ui'
import { api } from '../../data/api'
import type { Answer } from '../../data/types'
import { fmtDeadline } from '../../data/time'
import { EASE_OUT } from '../../motion/presets'
import { sfx, vibrate } from '../../app/sound'

/** P8 — exit page: requirements, feedback, submit (MOTION #9). */
export function Exit() {
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state, prog, reload } = useParticipant()
  const [answers, setAnswers] = useState<Answer[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)
  const timer = useRef(0)

  useEffect(() => {
    if (state && !answers) setAnswers(state.answers)
  }, [state, answers])
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!content || !state || !prog || !answers) return <Loading />
  if (prog.locked && !sending) return <Navigate to="/status" replace />

  const total = content.booths.length
  const questions = [...content.questions].sort((a, b) => a.sort - b.sort)
  const get = (id: string) => answers.find((a) => a.questionId === id)
  const answered = (id: string) => {
    const a = get(id)
    return !!(a?.nilaiInt || a?.nilaiTeks?.trim())
  }
  const required = questions.filter((q) => q.wajib)
  const answeredReq = required.filter((q) => answered(q.id)).length

  const setAnswer = (questionId: string, patch: Partial<Answer>) => {
    const next = [...answers.filter((a) => a.questionId !== questionId), { questionId, nilaiInt: null, nilaiTeks: null, ...get(questionId), ...patch }]
    setAnswers(next)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => api.saveFeedback(next).then(reload).catch(() => {}), 700)
  }

  const missingQ = required.findIndex((q) => !answered(q.id))
  const reason =
    prog.pastDeadline
      ? `The deadline (${fmtDeadline(content.settings.deadline)}) has passed.`
      : prog.stampCount < total
        ? `${total - prog.stampCount} booth(s) still need a stamp.`
        : prog.resumeCount < total
          ? `Finish notes for ${total - prog.resumeCount} more booth(s).`
          : missingQ >= 0
            ? `Answer question ${questions.indexOf(required[missingQ]) + 1} to submit`
            : ''

  const submit = async () => {
    setBusy(true)
    setErr('')
    try {
      clearTimeout(timer.current)
      await api.saveFeedback(answers)
      await api.submit()
      setSending(true)
      if (!reduce) {
        setTimeout(() => {
          sfx.thunk()
          vibrate(80)
        }, 1150)
        await new Promise((r) => setTimeout(r, 1900))
      }
      await reload()
      nav('/status', { replace: true })
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  const checks = [
    { ok: prog.stampCount >= total, label: `${total} booths stamped`, n: 1 },
    { ok: prog.resumeCount >= total, label: `${total} booth notes done`, n: 2 },
    { ok: answeredReq === required.length, label: `Feedback · ${answeredReq} of ${required.length} required`, n: 3 },
  ]

  return (
    <main className="screen-bg flex min-h-dvh flex-col pb-5">
      <BackHeader kicker="Exit page" to="/passport" />
      <div className="px-5">
        <h1 className="text-[26px] leading-tight font-extrabold text-white">One last step</h1>
        {state.submission?.status === 'revision' && (
          <p className="mt-2 rounded-xl border border-yellow/50 bg-[#2a1a0c] p-3 text-[14px]">
            <b className="text-yellow">Committee note:</b> {state.submission.reviewerNote}
          </p>
        )}
        <ul className="mt-3 flex flex-col gap-2.5">
          {checks.map((c) => (
            <li key={c.n} className="flex items-center gap-3 text-[15px]">
              {c.ok ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ok text-white">
                  <Icon.Check className="h-4 w-4" />
                </span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-yellow text-[13px] font-bold text-yellow">{c.n}</span>
              )}
              {c.label}
            </li>
          ))}
        </ul>
      </div>

      <section className="mx-4 mt-5 rounded-[10px] bg-paper px-4 py-5 text-ink shadow-xl" aria-label="Feedback">
        {questions.map((q, qi) => (
          <fieldset key={q.id} className={qi ? 'mt-5' : ''}>
            <legend className="text-[15px] leading-snug font-extrabold">
              {qi + 1}. {q.teks} {q.wajib ? <span className="text-red">*</span> : <span className="font-normal text-[#7a7068]">(optional)</span>}
            </legend>
            {q.tipe === 'skala_1_5' ? (
              <div className="mt-2.5 grid grid-cols-5 gap-2" role="radiogroup" aria-label={q.teks}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = get(q.id)?.nilaiInt === n
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAnswer(q.id, { nilaiInt: n })}
                      className={`h-12 rounded-[12px] border text-[16px] transition-colors ${on ? 'border-navy bg-navy font-extrabold text-yellow' : 'border-[#d5cabd] bg-white text-ink'}`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            ) : (
              <textarea rows={3} className="field-paper mt-2.5 resize-none" aria-label={q.teks} value={get(q.id)?.nilaiTeks ?? ''} onChange={(e) => setAnswer(q.id, { nilaiTeks: e.target.value })} />
            )}
          </fieldset>
        ))}
      </section>

      <div className="mt-auto px-5 pt-6">
        <ErrorText>{err}</ErrorText>
        <button type="button" onClick={submit} disabled={!!reason || busy} className="btn btn-red mt-2 w-full">
          {busy && !sending ? <Spinner /> : state.submission?.status === 'revision' ? 'Resubmit' : 'Submit'}
        </button>
        <p className="mt-2 min-h-5 text-center text-[14px] text-muted">{reason || `Deadline: ${fmtDeadline(content.settings.deadline)} WIB`}</p>
      </div>

      <AnimatePresence>{sending && !reduce && <EnvelopeAnimation />}</AnimatePresence>
    </main>
  )
}

/** 4 resume cards stack into a cream envelope, flap closes, red TERKIRIM stamp lands. */
function EnvelopeAnimation() {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" aria-label="Sending submission">
      <div className="relative h-[200px] w-[280px]">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute left-[40px] h-[130px] w-[200px] rounded-md bg-paper p-3 shadow-lg"
            initial={{ x: (i - 1.5) * 70, y: -160 + (i % 2) * 30, rotate: (i - 1.5) * 8, opacity: 0 }}
            animate={{ x: 0, y: [-120, 30], rotate: 0, opacity: [1, 1, 0] }}
            transition={{ duration: 0.75, delay: i * 0.08, ease: EASE_OUT, times: [0, 0.85, 1] }}
          >
            <div className="h-2 w-3/4 rounded bg-[#d9cfbf]" />
            <div className="mt-2 h-2 w-1/2 rounded bg-[#d9cfbf]" />
            <div className="mt-2 h-2 w-2/3 rounded bg-[#d9cfbf]" />
          </motion.div>
        ))}
        <div className="absolute inset-x-0 bottom-0 h-[150px] rounded-md bg-[#efe3cf] shadow-2xl" />
        <motion.div
          className="absolute inset-x-0 bottom-[75px] h-[75px] origin-top bg-[#e6d6bc]"
          style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', transformOrigin: 'top' }}
          initial={{ rotateX: 180, y: -75 }}
          animate={{ rotateX: 0, y: 0 }}
          transition={{ delay: 0.75, duration: 0.35 }}
        />
        <motion.div
          className="absolute top-[110px] left-1/2 -translate-x-1/2 rounded border-4 border-red px-4 py-1 font-display text-[26px] tracking-[0.12em] text-red"
          initial={{ scale: 2, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: -12 }}
          transition={{ delay: 1.15, type: 'spring', stiffness: 500, damping: 28 }}
        >
          SENT
        </motion.div>
      </div>
    </motion.div>
  )
}
