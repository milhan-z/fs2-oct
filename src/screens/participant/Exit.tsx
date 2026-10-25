import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { ErrorText, Spinner } from '../../components/ui'
import { api } from '../../data/api'
import type { Answer, Question } from '../../data/types'
import { fmtDeadline } from '../../data/time'
import { haptic, sfx, vibrate } from '../../app/sound'
import { InkIcon } from '../../booklet/icons'
import { ClippedSlip, Folio, PageNo, PageSkeleton } from '../../booklet/print'

const EASE = [0.22, 1, 0.36, 1] as const

/** P8 — exit page: a printed checklist and feedback form on passport paper; submit (MOTION #9). */
export function Exit({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state, prog, reload } = useParticipant()
  const [answers, setAnswers] = useState<Answer[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)
  const [step, setStep] = useState<number | null>(null)
  const timer = useRef(0)

  useEffect(() => {
    if (state && !answers) setAnswers(state.answers)
  }, [state, answers])
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!content || !state || !prog || !answers) return <PageSkeleton />
  if (prog.locked && !sending) return <Navigate to="/status" replace />

  const total = content.booths.length
  const questions = [...content.questions].sort((a, b) => a.sort - b.sort)
  const get = (id: string) => answers.find((a) => a.questionId === id)
  const answered = (id: string) => {
    const a = get(id)
    return !!(a?.nilaiInt || a?.nilaiTeks?.trim())
  }
  const required = questions.filter((q) => q.wajib)
  const firstOpen = questions.findIndex((q) => !answered(q.id))
  const startStep = step ?? (firstOpen < 0 ? 0 : firstOpen)
  const answeredReq = required.filter((q) => answered(q.id)).length

  const setAnswer = (questionId: string, patch: Partial<Answer>) => {
    const next = [...answers.filter((a) => a.questionId !== questionId), { questionId, nilaiInt: null, nilaiTeks: null, ...get(questionId), ...patch }]
    setAnswers(next)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => api.saveFeedback(next).then(reload).catch(() => {}), 700)
  }

  const missingQ = required.findIndex((q) => !answered(q.id))
  const reason = prog.pastDeadline
    ? `The deadline (${fmtDeadline(content.settings.deadline)}) has passed.`
    : prog.stampCount < total
      ? `${total - prog.stampCount} booth(s) still need a stamp.`
      : prog.resumeCount < total
        ? `Finish notes for ${total - prog.resumeCount} more booth(s).`
        : missingQ >= 0
          ? `Answer question ${questions.indexOf(required[missingQ]) + 1} of ${questions.length} to submit`
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
    <div className="relative flex min-h-full flex-col px-6 pt-3 pb-12">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Close" onClick={onClose} className="-ml-3 flex h-11 w-11 items-center justify-center text-ink/80">
          <InkIcon.Close className="h-5 w-5" />
        </button>
        <Folio left="Exit page" serial={`FS2-${state.participant.nrpLast4}`} className="flex-1" />
      </div>

      <h1 className="page-title mt-6">Last checkpoint</h1>

      {state.submission?.status === 'revision' && (
        <ClippedSlip className="mt-6">
          <b>Committee note:</b> {state.submission.reviewerNote}
        </ClippedSlip>
      )}

      <ul className="mt-6 flex flex-col">
        {checks.map((c) => (
          <li key={c.n} className="flex items-center gap-3 border-b border-ink/15 py-3 text-[15px]">
            {c.ok ? (
              <span className="flex h-5 w-5 flex-none items-center justify-center border-[1.5px] border-ink/60">
                <InkIcon.Check className="h-4 w-4 text-stamp" />
              </span>
            ) : (
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-[1.5px] border-[#8a5a12] font-mono text-[11px] font-bold text-[#8a5a12]">{c.n}</span>
            )}
            {c.label}
          </li>
        ))}
      </ul>

      {questions.length > 0 && (
        <FeedbackStepper
          questions={questions}
          step={Math.min(startStep, questions.length - 1)}
          setStep={setStep}
          get={get}
          answered={answered}
          setAnswer={setAnswer}
          reduce={!!reduce}
        />
      )}

      <div className="mt-auto pt-10">
        <ErrorText onPaper>{err}</ErrorText>
        <motion.button type="button" onClick={submit} disabled={!!reason || busy} whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} className="btn btn-primary mt-2 w-full">
          {busy && !sending ? <Spinner /> : state.submission?.status === 'revision' ? 'Resubmit' : 'Submit'}
        </motion.button>
        <p className="mt-2 min-h-5 text-[13px] text-ink/65">{reason || `Deadline: ${fmtDeadline(content.settings.deadline)} WIB`}</p>
      </div>
      <PageNo n={9} />

      {createPortal(<AnimatePresence>{sending && !reduce && <EnvelopeAnimation />}</AnimatePresence>, document.body)}
    </div>
  )
}

/** The note pages fold into a cream envelope, the flap closes, the red SENT ink stamp lands. */
function EnvelopeAnimation() {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-night-0/85" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" aria-label="Sending submission">
      <div className="relative h-[200px] w-[280px]">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="mat-paper absolute left-[40px] h-[130px] w-[200px] p-3 shadow-[var(--shadow-lift)]"
            initial={{ x: (i - 1.5) * 70, y: -160 + (i % 2) * 30, rotate: (i - 1.5) * 8, opacity: 0 }}
            animate={{ x: 0, y: [-120, 30], rotate: 0, opacity: [1, 1, 0] }}
            transition={{ duration: 0.75, delay: i * 0.08, ease: EASE, times: [0, 0.85, 1] }}
          >
            <div className="h-px w-3/4 bg-ink/25" />
            <div className="mt-3 h-px w-1/2 bg-ink/25" />
            <div className="mt-3 h-px w-2/3 bg-ink/25" />
          </motion.div>
        ))}
        <div className="absolute inset-x-0 bottom-0 h-[150px] rounded-[2px] bg-[#efe3cf] shadow-[var(--shadow-lift)]" />
        <motion.div
          className="absolute inset-x-0 bottom-[75px] h-[75px] bg-[#e6d6bc]"
          style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', transformOrigin: 'top' }}
          initial={{ rotateX: 180, y: -75 }}
          animate={{ rotateX: 0, y: 0 }}
          transition={{ delay: 0.75, duration: 0.35 }}
        />
        <motion.div
          className="absolute top-[110px] left-1/2 -translate-x-1/2 rounded-[3px] border-[3px] border-stamp px-4 py-1 font-display text-[34px] tracking-[0.12em] text-stamp"
          style={{ WebkitMaskImage: 'var(--tex-ink-mask)', maskImage: 'var(--tex-ink-mask)' }}
          initial={{ scale: 2, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 0.9, rotate: -12 }}
          transition={{ delay: 1.15, type: 'spring', stiffness: 500, damping: 28 }}
        >
          SENT
        </motion.div>
      </div>
    </motion.div>
  )
}


/**
 * Feedback, one question at a time — works for 3 questions or 30. A scale answer moves on by
 * itself; the progress segments are tappable to jump back or ahead.
 */
function FeedbackStepper({
  questions,
  step,
  setStep,
  get,
  answered,
  setAnswer,
  reduce,
}: {
  questions: Question[]
  step: number
  setStep: (n: number) => void
  get: (id: string) => Answer | undefined
  answered: (id: string) => boolean
  setAnswer: (id: string, patch: Partial<Answer>) => void
  reduce: boolean
}) {
  const q = questions[step]
  const n = questions.length
  const dir = useRef(1)
  const go = (to: number) => {
    dir.current = to >= step ? 1 : -1
    setStep(Math.max(0, Math.min(n - 1, to)))
  }
  const advance = useRef(0)
  useEffect(() => () => clearTimeout(advance.current), [])
  const doneCount = questions.filter((x) => answered(x.id)).length
  return (
    <section className="mt-8" aria-label="Feedback">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-[20px] font-bold">Feedback</h2>
        <p className="font-mono text-[12px] text-ink/65" aria-live="polite">
          Question {step + 1} of {n} · {doneCount} answered
        </p>
      </div>
      <ol className="mt-3 flex gap-1" aria-label="Questions">
        {questions.map((x, i) => (
          <li key={x.id} className="flex-1">
            <button
              type="button"
              aria-label={`Question ${i + 1}${answered(x.id) ? ', answered' : x.wajib ? ', required' : ''}`}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => go(i)}
              className="group flex h-6 w-full items-center"
            >
              <span className={`block h-[5px] w-full rounded-full transition-colors duration-150 ${i === step ? 'bg-stamp' : answered(x.id) ? 'bg-ink/70' : 'bg-ink/20'}`} />
            </button>
          </li>
        ))}
      </ol>

      <div className="relative mt-3 min-h-[188px] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.fieldset
            key={q.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 28 * dir.current }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -28 * dir.current }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            <legend className="text-[17px] leading-snug font-semibold">
              {q.section && <span className="mb-1.5 block font-mono text-[12px] leading-snug font-normal tracking-[0.1em] text-stamp uppercase">{q.section}</span>}
              {q.teks} {q.wajib ? <span className="text-stamp">*</span> : <span className="font-normal text-ink/55">(optional)</span>}
            </legend>
            {q.tipe === 'skala_1_5' ? (
              <>
                <div className="mt-4 grid grid-cols-5 gap-2" role="radiogroup" aria-label={q.teks}>
                  {[1, 2, 3, 4, 5].map((v) => {
                    const on = get(q.id)?.nilaiInt === v
                    return (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          haptic.tick()
                          setAnswer(q.id, { nilaiInt: v })
                          clearTimeout(advance.current)
                          if (step < n - 1) advance.current = window.setTimeout(() => go(step + 1), reduce ? 0 : 280)
                        }}
                        className={`h-12 rounded-[4px] font-mono text-[18px] transition-colors duration-[120ms] ${on ? 'bg-ink font-bold text-paper' : 'text-ink shadow-[inset_0_0_0_1.5px_rgba(42,30,26,.45)]'}`}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 flex justify-between text-[12px] text-ink/55">
                  <span>{q.labelLow || 'Poor'}</span>
                  <span>{q.labelHigh || 'Excellent'}</span>
                </p>
              </>
            ) : (
              <>
                <textarea rows={4} className="ruled mt-4" aria-label={q.teks} value={get(q.id)?.nilaiTeks ?? ''} onChange={(e) => setAnswer(q.id, { nilaiTeks: e.target.value })} />
                {q.wajib && <p className="mt-1 text-[12px] text-ink/60">Nothing to add? Write “-”.</p>}
              </>
            )}
          </motion.fieldset>
        </AnimatePresence>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="min-h-11 px-1 text-[15px] font-semibold text-ink/80 underline underline-offset-4 disabled:opacity-0">
          Back
        </button>
        {step < n - 1 && (
          <button type="button" onClick={() => go(step + 1)} disabled={q.wajib && !answered(q.id)} className="min-h-11 px-1 text-[15px] font-semibold text-stamp underline underline-offset-4 disabled:text-ink/35 disabled:no-underline">
            {answered(q.id) ? 'Next →' : q.wajib ? 'Next →' : 'Skip →'}
          </button>
        )}
      </div>
    </section>
  )
}
