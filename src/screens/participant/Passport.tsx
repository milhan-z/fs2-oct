import { motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { Icon, StampImg } from '../../components/decor'
import { Loading } from '../../components/ui'
import { resumeDone } from '../../data/rules'
import { pinLabel } from '../../map/geometry'
import { fmtDeadline, fmtTime } from '../../data/time'

export function shortUni(u: string): string {
  const paren = u.match(/\(([^)]+)\)/)
  if (paren) return paren[1]
  return u.split(/[,/]/)[0].trim()
}

/** P6 — passport: identity, 4 visa pages, submit requirements. Also the exit-gate proof. */
export function Passport() {
  const nav = useNavigate()
  const { content } = useContent()
  const { state, prog } = useParticipant()
  if (!content || !state || !prog) return <Loading />

  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const total = booths.length
  const min = content.rules.min_kata_per_poin
  const need = content.rules.poin_per_resume
  const sub = state.submission
  const canRetake = !prog.locked

  const req = [
    { ok: prog.stampCount >= total, label: `${total} booths stamped`, detail: `(${prog.stampCount}/${total})` },
    { ok: prog.resumeCount >= total, label: `${total} booth notes done`, detail: `(${prog.resumeCount}/${total})` },
    { ok: prog.feedbackDone, label: 'Feedback', detail: prog.feedbackDone ? '(done)' : '(not yet)' },
  ]

  return (
    <main className="screen-bg-red flex flex-1 flex-col px-5 pt-5 pb-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => canRetake && nav('/photo?ulang=1')}
          aria-label={canRetake ? 'Retake attendance photo' : 'Attendance photo'}
          className="w-[68px] flex-none -rotate-3 bg-[#f4efe4] p-[5px] pb-[14px] shadow-lg"
        >
          <div className="aspect-square overflow-hidden bg-[#2a2f37]">{state.participant.photo && <img src={state.participant.photo} alt="" className="h-full w-full object-cover" />}</div>
        </button>
        <div className="min-w-0">
          <p className="kicker text-[12px]">FS² Passport · October</p>
          <h1 className="truncate text-[20px] leading-tight font-extrabold text-white">{state.participant.nama}</h1>
          <p className="truncate text-[14px] text-muted">
            NRP {state.participant.nrpMasked} · {state.participant.departemen}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <h2 className="font-serif text-[18px] font-bold text-white">Visa pages</h2>
        <span className="text-[14px] text-muted">
          {prog.stampCount}/{total} stamped · {prog.resumeCount}/{total} notes
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {booths.map((b, i) => {
          const visit = state.visits.find((v) => v.boothId === b.id)
          const sp = content.speakers.filter((s) => s.boothId === b.id)
          const done = resumeDone(state, b.id, min)
          const complete = done >= need
          const title = sp.map((s) => s.nama).join(' & ') || b.nama
          return (
            <motion.li key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <button
                type="button"
                onClick={() => (visit ? nav(`/visa/${b.id}`) : nav(`/map?booth=${b.id}`))}
                className={`flex w-full items-center gap-4 rounded-[18px] p-4 text-left ${
                  visit ? (complete ? 'border border-[#4a2a2c] bg-[#1a0a0c]/60' : 'border-2 border-yellow bg-[#1a0a0c]/60') : 'border border-dashed border-[#5a4a4c] bg-black/10'
                }`}
              >
                <div className="flex h-[60px] w-[60px] flex-none items-center justify-center">
                  {visit ? (
                    <StampImg src={b.stamp} alt={`${b.nama} stamp`} className="h-[60px] w-[60px] -rotate-6" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded-[6px] border-2 border-dashed border-[#6b5f5a] font-display text-[13px] tracking-wide text-muted">{pinLabel(b.nama, b.sort)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[15px] leading-tight font-extrabold ${visit ? 'text-white' : 'text-cream/90'}`}>{title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {b.nama} booth
                    {sp[0] && ` · ${shortUni(sp[0].universitas)}`}
                    {visit && ` · stamped ${fmtTime(visit.confirmedAt)}`}
                  </p>
                </div>
                <span className={`flex-none text-[14px] font-bold ${!visit ? 'text-muted font-normal' : complete ? 'text-ok-bright' : 'text-yellow'}`}>
                  {!visit ? 'Not stamped' : complete ? (
                    <span className="flex items-center gap-1">
                      {need}/{need} <Icon.Check className="h-4 w-4" />
                    </span>
                  ) : done > 0 ? `${done}/${need}` : 'Write notes'}
                </span>
              </button>
            </motion.li>
          )
        })}
      </ul>

      {sub ? (
        <button type="button" onClick={() => nav('/status')} className="mt-4 rounded-[18px] border border-yellow/60 bg-[#2a1a0c] p-4 text-left">
          <p className="kicker text-[12px]">Submission {sub.code}</p>
          <p className="mt-1 text-[15px] font-bold">{sub.status === 'submitted' ? 'Awaiting review' : sub.status === 'revision' ? 'Needs revision — see note' : 'Approved'}</p>
        </button>
      ) : (
        <div className="mt-4 rounded-[18px] border border-[#7a5a1c] bg-[#2a1a0c]/80 p-4">
          <p className="kicker text-[12px]">To submit · Deadline {fmtDeadline(content.settings.deadline)}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {req.map((r) => (
              <li key={r.label} className="flex items-center gap-2 text-[15px]">
                {r.ok ? <Icon.Check className="h-4 w-4 text-ok-bright" /> : <span className="w-4 text-center">○</span>}
                <span>{r.label}</span>
                <span className="text-muted">{r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={() => nav(sub && sub.status !== 'revision' ? '/status' : '/exit')} className="btn btn-ghost mt-4 w-full">
        {sub && sub.status !== 'revision' ? 'View status' : 'Go to Exit page'}
      </button>
      <button type="button" onClick={() => nav('/guide')} className="mt-2 min-h-11 text-[14px] text-muted underline underline-offset-4">
        Guide & help
      </button>
    </main>
  )
}
