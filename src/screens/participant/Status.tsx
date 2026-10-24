import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { BigLights } from '../../components/ChristmasLights'
import { Loading, Spinner } from '../../components/ui'
import { fmtTime } from '../../data/time'

const STAMP = {
  submitted: { text: 'AWAITING REVIEW', color: '#D22B26' },
  revision: { text: 'NEEDS REVISION', color: '#c46a00' },
  approved: { text: 'APPROVED', color: '#2e7d32' },
} as const

/** P9 — submission status. */
export function Status() {
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state, reload } = useParticipant()
  const [busy, setBusy] = useState(false)
  if (!content || !state) return <Loading />
  const sub = state.submission

  if (!sub) {
    return (
      <main className="screen-bg flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[16px] font-bold">No submission yet.</p>
        <button type="button" className="btn btn-red" onClick={() => nav('/exit')}>
          Go to Exit page
        </button>
      </main>
    )
  }
  const st = STAMP[sub.status]
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)

  const refresh = async () => {
    setBusy(true)
    await reload()
    setBusy(false)
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-6" style={{ background: 'radial-gradient(80% 40% at 50% 30%, #3a0d10 0%, #150a0c 55%, #0b1020 100%)' }}>
      <BigLights lit={4} className="mx-auto mt-4 w-[78%] max-w-[300px]" />
      <p className="kicker mt-3 text-center">Submission status</p>

      <div className="mx-auto mt-5 w-full max-w-[320px] rounded-[10px] bg-paper px-5 pt-7 pb-6 text-center shadow-xl">
        <motion.div
          key={sub.status}
          className="mx-auto inline-block -rotate-6 rounded-[6px] border-[5px] px-4 py-2 text-[22px] leading-[1.1] font-extrabold tracking-[0.08em]"
          style={{ borderColor: st.color, color: st.color, boxShadow: `0 0 0 2px #f6f1e7, 0 0 0 4px ${st.color}` }}
          initial={reduce ? false : { scale: 1.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          {st.text}
        </motion.div>
        <p className="mt-5 text-[14px] text-[#5a5048]">Submission code</p>
        <p className="font-mono text-[26px] font-bold tracking-[0.1em] text-navy">{sub.code}</p>
      </div>

      {sub.status === 'revision' && sub.reviewerNote && (
        <div className="mt-4 rounded-xl border border-yellow/50 bg-[#2a1a0c] p-4 text-[14px]">
          <p className="kicker text-[12px]">Committee note</p>
          <p className="mt-1">{sub.reviewerNote}</p>
        </div>
      )}

      <dl className="mt-5 divide-y divide-[#3a2a2e] border-y border-[#3a2a2e] text-[15px]">
        <div className="flex justify-between py-3.5">
          <dt className="text-muted">Submitted</dt>
          <dd>
            {fmtTime(sub.submittedAt)} WIB{sub.version > 1 ? ` · version ${sub.version}` : ''}
          </dd>
        </div>
        <div className="flex justify-between py-3.5">
          <dt className="text-muted">Booths included</dt>
          <dd>{booths.filter((b) => state.visits.some((v) => v.boothId === b.id)).map((b) => b.id).join(', ')}</dd>
        </div>
        <div className="flex justify-between py-3.5">
          <dt className="text-muted">Stamp4It</dt>
          <dd className={state.stamp4it ? 'font-bold text-ok-bright' : ''}>{state.stamp4it ? 'Given' : 'Not given yet'}</dd>
        </div>
      </dl>

      <p className="mt-5 text-center text-[14px] text-muted">
        {sub.status === 'submitted'
          ? 'Submission sent. The committee will announce the review results after the event.'
          : sub.status === 'revision'
            ? 'Update your notes/feedback based on the note, then resubmit before the deadline.'
            : 'Congratulations! Your submission is approved.'}
      </p>

      <img src="/assets/gsm/skyline.svg" alt="" aria-hidden="true" className="pointer-events-none mx-auto mt-auto w-full max-w-[360px] pt-6 opacity-70" />
      <div className="grid grid-cols-2 gap-3 pt-4">
        <button type="button" onClick={() => nav('/passport')} className="btn btn-ghost">
          Passport
        </button>
        {sub.status === 'revision' ? (
          <button type="button" onClick={() => nav('/exit')} className="btn btn-yellow">
            Revise
          </button>
        ) : (
          <button type="button" onClick={refresh} className="btn btn-cream" disabled={busy}>
            {busy ? <Spinner /> : 'Refresh'}
          </button>
        )}
      </div>
    </main>
  )
}
