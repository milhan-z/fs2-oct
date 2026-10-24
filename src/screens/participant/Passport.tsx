import { motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { resumeDone } from '../../data/rules'
import { fmtDeadline, fmtTime } from '../../data/time'
import { InkIcon } from '../../booklet/icons'
import { DocLabel, Folio, InkStamp, MRZ, PageSkeleton } from '../../booklet/print'
import { setOrigin } from '../../booklet/pages'

export function shortUni(u: string): string {
  const paren = u.match(/\(([^)]+)\)/)
  if (paren) return paren[1]
  return u.split(/[,/]/)[0].trim()
}

/**
 * P6 — the passport on one full page: identity data, the four visas with a clear next action on
 * each (tap one to open that visa page as a pop-up — stamp + notes), and the printed
 * requirements. It is also the exit-gate proof: four stamps visible at a glance.
 */
export function Passport() {
  const nav = useNavigate()
  const { content } = useContent()
  const { state, prog } = useParticipant()
  if (!content || !state || !prog) return <PageSkeleton photo />

  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const total = booths.length
  const min = content.rules.min_kata_per_poin
  const need = content.rules.poin_per_resume
  const sub = state.submission
  const canRetake = !prog.locked
  const p = state.participant
  const ready = prog.stampCount >= total && prog.resumeCount >= total
  const open = (el: Element, to: string) => {
    setOrigin(el)
    nav(to)
  }

  return (
    <div className="relative flex min-h-full flex-col px-5 pt-4 pb-10">
      <Folio left="FS² Passport · October" serial={`FS2-${p.nrpLast4}`} />

      {/* identity */}
      <div className="mt-5 grid grid-cols-[104px_1fr] gap-4">
        <button type="button" onClick={() => canRetake && nav('/photo?ulang=1')} aria-label={canRetake ? 'Retake attendance photo' : 'Attendance photo'} className="relative aspect-[3/4] w-full bg-[#2a2f37] shadow-[var(--shadow-contact)]">
          {p.photo && <img src={p.photo} alt="" className="h-full w-full object-cover" />}
          {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'right-0 bottom-0 border-r-2 border-b-2'].map((c) => (
            <span key={c} className={`pointer-events-none absolute h-3 w-3 border-[#8a8f99] ${c}`} aria-hidden="true" />
          ))}
        </button>
        <dl className="flex min-w-0 flex-col gap-2.5">
          <div>
            <DocLabel>Full name</DocLabel>
            <dd className="font-serif text-[20px] leading-tight font-bold">{p.nama}</dd>
          </div>
          <div className="flex gap-5">
            <div>
              <DocLabel>NRP</DocLabel>
              <dd className="doc-data">{p.nrpMasked}</dd>
            </div>
            <div>
              <DocLabel>Class of</DocLabel>
              <dd className="doc-data">{p.angkatan}</dd>
            </div>
          </div>
          <div>
            <DocLabel>Department</DocLabel>
            <dd className="text-[14px] leading-tight">{p.departemen}</dd>
          </div>
        </dl>
      </div>
      <MRZ name={p.nama} last4={p.nrpLast4} className="mt-4" />

      {/* visas */}
      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-serif text-[22px] font-bold">Visa pages</h2>
        <span className="font-mono text-[12px] text-ink/65">
          {prog.stampCount}/{total} stamped · {prog.resumeCount}/{total} notes
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
        {booths.map((b) => {
          const visit = state.visits.find((v) => v.boothId === b.id)
          const sp = content.speakers.filter((s) => s.boothId === b.id)
          const done = resumeDone(state, b.id, min)
          const complete = done >= need
          return (
            <li key={b.id}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.06 }}
                onClick={(e) => open(e.currentTarget, `/visa/${b.id}`)}
                className="flex w-full flex-col items-stretch text-left"
                aria-label={`${b.nama} visa`}
              >
                <span className="flex aspect-square items-center justify-center border-[3px] border-double border-ink/30">
                  <InkStamp src={b.stamp} seed={b.id} size={104} alt="" pending={!visit} />
                </span>
                <span className="mt-2 font-serif text-[16px] leading-tight font-bold">{b.nama}</span>
                {sp[0] && <span className="truncate text-[12px] text-ink/60">{shortUni(sp[0].universitas)}</span>}
                {/* the next action for this visa, always spelled out */}
                <span className={`mt-1 flex items-center gap-1 text-[13px] font-semibold ${!visit ? 'text-ink/60' : complete ? 'text-[#2e7d32]' : 'text-stamp'}`}>
                  {!visit ? (
                    <>Not stamped · visit the booth</>
                  ) : complete ? (
                    <>
                      Notes done <InkIcon.Check className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      Write notes · <span className="font-mono">{done}/{need}</span> →
                    </>
                  )}
                </span>
                {visit && <span className="font-mono text-[11px] text-ink/50">stamped {fmtTime(visit.confirmedAt)}</span>}
              </motion.button>
            </li>
          )
        })}
      </ul>

      {/* requirements / submission */}
      <section className="mt-9">
        {sub ? (
          <button type="button" onClick={() => nav('/status')} className="block w-full border-y border-ink/15 py-4 text-left">
            <p className="font-mono text-[12px] tracking-[0.12em] text-ink/60 uppercase">Submission {sub.code}</p>
            <p className="mt-1 flex items-center justify-between font-serif text-[20px] font-bold">
              {sub.status === 'submitted' ? 'Awaiting review' : sub.status === 'revision' ? 'Needs revision — see note' : 'Approved'}
              <span className="font-sans text-[14px] font-semibold text-stamp">View status →</span>
            </p>
          </button>
        ) : (
          <>
            <p className="font-mono text-[12px] tracking-[0.08em] text-ink/65 uppercase">To submit · Deadline {fmtDeadline(content.settings.deadline)}</p>
            <ul className="mt-2 flex flex-col">
              {[
                { ok: prog.stampCount >= total, label: `${total} booths stamped`, detail: `(${prog.stampCount}/${total})` },
                { ok: prog.resumeCount >= total, label: `${total} booth notes done`, detail: `(${prog.resumeCount}/${total})` },
              ].map((r) => (
                <li key={r.label} className="flex items-center gap-3 border-b border-ink/15 py-3 text-[15px]">
                  <span className="flex h-5 w-5 flex-none items-center justify-center border-[1.5px] border-ink/60">{r.ok && <InkIcon.Check className="h-4 w-4 text-stamp" />}</span>
                  <span>{r.label}</span>
                  <span className="font-mono text-ink/55">{r.detail}</span>
                </li>
              ))}
              <li className="border-b border-ink/15">
                <button type="button" disabled={!ready} onClick={(e) => open(e.currentTarget, '/exit')} className="flex min-h-12 w-full items-center gap-3 py-3 text-left text-[15px] disabled:cursor-default">
                  <span className="flex h-5 w-5 flex-none items-center justify-center border-[1.5px] border-ink/60">{prog.feedbackDone && <InkIcon.Check className="h-4 w-4 text-stamp" />}</span>
                  <span>Feedback</span>
                  <span className="font-mono text-ink/55">{prog.feedbackDone ? '(done)' : '(not yet)'}</span>
                  <span className={`ml-auto text-[14px] font-semibold ${ready ? 'text-stamp' : 'text-ink/35'}`}>{ready ? 'Answer & submit →' : 'After 4 notes'}</span>
                </button>
              </li>
            </ul>
          </>
        )}
      </section>

      <button type="button" onClick={() => nav('/guide')} className="mt-6 min-h-11 self-start text-[14px] text-ink/65 underline underline-offset-4">
        Guide & help
      </button>
    </div>
  )
}
