import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { Spinner } from '../../components/ui'
import { fmtTime } from '../../data/time'
import { ClippedSlip, DocLabel, Folio, PageNo, PageSkeleton } from '../../booklet/print'
import { setOrigin } from '../../booklet/pages'

const STAMP = {
  submitted: { text: 'AWAITING REVIEW', color: '#b3261e' },
  revision: { text: 'NEEDS REVISION', color: '#a35a00' },
  approved: { text: 'APPROVED', color: '#2e7d32' },
} as const

/** P9 — submission status, printed on the last page; the status is an ink stamp, not a card. */
export function Status() {
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state, reload } = useParticipant()
  const [busy, setBusy] = useState(false)
  if (!content || !state) return <PageSkeleton />
  const sub = state.submission

  if (!sub) {
    return (
      <div className="flex min-h-full flex-col px-6 pt-10">
        <p className="font-serif text-[22px] font-bold">No submission yet.</p>
        <motion.button type="button" whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} className="btn btn-primary mt-6 self-start" onClick={(e) => (setOrigin(e.currentTarget), nav('/exit'))}>
          Go to Exit page
        </motion.button>
      </div>
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
    <div className="relative flex min-h-full flex-col px-6 pt-4 pb-12">
      <Folio left="Submission status" serial={`FS2-${state.participant.nrpLast4}`} />

      <div className="relative mt-8 flex justify-center py-4">
        <motion.div
          key={sub.status}
          className="inline-block rotate-[-7deg] rounded-[3px] px-4 py-2 text-center font-display text-[26px] leading-[1.1] tracking-[0.08em]"
          style={{ color: st.color, boxShadow: `inset 0 0 0 3px ${st.color}, inset 0 0 0 6px #f3ebdd, inset 0 0 0 7.5px ${st.color}`, WebkitMaskImage: 'var(--tex-ink-mask)', maskImage: 'var(--tex-ink-mask)', opacity: 0.9 }}
          initial={reduce ? false : { scale: 1.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.9 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          {st.text}
        </motion.div>
      </div>

      <DocLabel className="mt-6">Submission code</DocLabel>
      <p className="font-mono text-[30px] font-bold tracking-[0.1em]">{sub.code}</p>

      {sub.status === 'revision' && sub.reviewerNote && (
        <ClippedSlip className="mt-6">
          <p className="font-mono text-[11px] tracking-[0.12em] text-ink/60 uppercase">Committee note</p>
          <p className="mt-1">{sub.reviewerNote}</p>
        </ClippedSlip>
      )}

      <dl className="mt-6 text-[15px]">
        <div className="flex justify-between border-b border-ink/15 py-3">
          <dt className="text-ink/65">Submitted</dt>
          <dd className="font-mono">
            {fmtTime(sub.submittedAt)} WIB{sub.version > 1 ? ` · version ${sub.version}` : ''}
          </dd>
        </div>
        <div className="flex justify-between border-b border-ink/15 py-3">
          <dt className="text-ink/65">Booths included</dt>
          <dd className="font-mono">{booths.filter((b) => state.visits.some((v) => v.boothId === b.id)).map((b) => b.id).join(', ')}</dd>
        </div>
        <div className="flex justify-between border-b border-ink/15 py-3">
          <dt className="text-ink/65">Stamp4It</dt>
          <dd className={state.stamp4it ? 'font-semibold text-[#2e7d32]' : ''}>{state.stamp4it ? 'Given' : 'Not given yet'}</dd>
        </div>
      </dl>

      <p className="mt-5 text-[15px] leading-[22px] text-ink/75">
        {sub.status === 'submitted'
          ? 'Your papers are with the committee. Review results are announced after the event.'
          : sub.status === 'revision'
            ? 'Update your notes/feedback based on the note, then resubmit before the deadline.'
            : 'Congratulations! Your submission is approved.'}
      </p>

      {/* printed vignette at the foot of the page */}
      <img src="/assets/gsm/skyline.svg" alt="" aria-hidden="true" className="pointer-events-none mt-auto w-full pt-8 opacity-25 mix-blend-multiply" />
      <div className="mt-4 flex items-center gap-4">
        <button type="button" onClick={() => nav('/passport')} className="min-h-12 px-1 text-[15px] font-semibold underline underline-offset-4">
          Passport
        </button>
        {sub.status === 'revision' ? (
          <motion.button type="button" whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} onClick={(e) => (setOrigin(e.currentTarget), nav('/exit'))} className="btn btn-primary flex-1">
            Revise
          </motion.button>
        ) : (
          <motion.button type="button" whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} onClick={refresh} className="btn btn-primary flex-1" disabled={busy}>
            {busy ? <Spinner /> : 'Refresh'}
          </motion.button>
        )}
      </div>
      <PageNo n={10} />
    </div>
  )
}
