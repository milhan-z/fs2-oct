import { useEffect, useState } from 'react'
import { api } from '../../data/api'
import { useLive } from '../../app/useAsync'
import { useContent } from '../../app/providers'
import type { SubmissionStatus } from '../../data/types'
import { fmtTime } from '../../data/time'
import { Loading, ErrorText, Spinner } from '../../components/ui'

const TABS: [SubmissionStatus, string][] = [
  ['submitted', 'Waiting'],
  ['revision', 'Needs revision'],
  ['approved', 'Approved'],
]

/** A2 — submission queue + detail with Approve / Return / Stamp4It. */
export function Submissions({ onChange }: { onChange: () => void }) {
  const [tab, setTab] = useState<SubmissionStatus>('submitted')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const list = useLive(() => api.adminListSubmissions(tab, q), [tab, q], 8000)

  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(300px,380px)_1fr]">
      <section className={`border-r border-[#e4ddd0] bg-white ${sel ? 'hidden md:block' : ''}`}>
        <div className="p-5">
          <h1 className="text-[26px] font-extrabold">Submissions</h1>
          <div className="mt-3 flex flex-wrap gap-2" role="tablist">
            {TABS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => (setTab(k), setSel(null))} className={`min-h-10 rounded-full border px-4 text-[14px] ${tab === k ? 'border-navy bg-navy font-bold text-white' : 'border-[#d5cabd]'}`}>
                {l}
              </button>
            ))}
          </div>
          <label htmlFor="sub-q" className="sr-only">
            Search
          </label>
          <input id="sub-q" className="field-paper mt-3" placeholder="Search NRP or name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul>
          {list.data?.map((r) => (
            <li key={r.submissionId}>
              <button type="button" onClick={() => setSel(r.participantId)} className={`flex w-full items-center justify-between border-b border-[#efe9df] px-5 py-3.5 text-left ${sel === r.participantId ? 'bg-[#eef1f5]' : 'hover:bg-[#faf8f4]'}`}>
                <span>
                  <span className="block font-bold">{r.nama}</span>
                  <span className="font-mono text-[13px] text-[#6b6058]">
                    {r.code} · {r.boothCount} booths{r.version > 1 ? ' · resubmitted' : ''}
                  </span>
                </span>
                <span className="text-[13px] text-[#6b6058]">{fmtTime(r.submittedAt)}</span>
              </button>
            </li>
          ))}
          {list.data && !list.data.length && <li className="px-5 py-4 text-[14px] text-[#6b6058]">No submissions.</li>}
        </ul>
      </section>
      <section className={`bg-[#f6f4ef] ${sel ? '' : 'hidden md:block'}`}>
        {sel ? (
          <Detail
            pid={sel}
            onBack={() => setSel(null)}
            onChange={() => {
              list.reload()
              onChange()
            }}
          />
        ) : (
          <p className="p-8 text-[#6b6058]">Pick a submission to review.</p>
        )}
      </section>
    </div>
  )
}

function Detail({ pid, onBack, onChange }: { pid: string; onBack: () => void; onChange: () => void }) {
  const { content } = useContent()
  const d = useLive(() => api.adminParticipantDetail(pid), [pid])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [s4i, setS4i] = useState<boolean | null>(null) // optimistic checkbox state
  useEffect(() => {
    setNote(d.data?.submission?.reviewerNote ?? '')
  }, [d.data?.submission?.reviewerNote])
  if (!d.data || !content) return <Loading dark={false} />
  const p = d.data
  const sub = p.submission
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const qs = [...content.questions].sort((a, b) => a.sort - b.sort)

  const act = async (kind: 'approve' | 'revision' | 's4i') => {
    setErr('')
    if (kind === 'revision' && !note.trim()) return setErr('Write a note for the participant before returning it.')
    setBusy(kind)
    try {
      if (kind === 's4i') {
        const next = !(s4i ?? p.stamp4it)
        setS4i(next)
        await api.adminSetStamp4it(pid, next)
      }
      else if (sub) await api.adminReview(sub.id, kind, note)
      await d.reload()
      onChange()
    } catch (e) {
      setErr((e as Error).message)
      setS4i(null)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-4 border-b border-[#e4ddd0] bg-white px-5 py-4">
        <button type="button" onClick={onBack} className="min-h-11 text-[14px] underline md:hidden">
          ← List
        </button>
        <div className="w-16 flex-none bg-[#f4efe4] p-1 pb-3 shadow">
          <div className="aspect-square bg-[#3a3f4a]">{p.photo && <img src={p.photo} alt={`Attendance photo of ${p.nama}`} className="h-full w-full object-cover" />}</div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-extrabold">{p.nama}</h2>
          <p className="text-[14px] text-[#6b6058]">
            NRP {p.nrp} · {p.departemen} · {p.angkatan}
            {sub && ` · submitted ${fmtTime(sub.submittedAt)}`}
          </p>
        </div>
        {sub && <p className="hidden font-mono text-[20px] font-bold tracking-[0.15em] sm:block">{sub.code}</p>}
      </header>

      <div className="grid flex-1 content-start gap-4 p-5 lg:grid-cols-2">
        {booths.map((b) => {
          const v = p.visits.find((x) => x.boothId === b.id)
          const r = p.resumes.find((x) => x.boothId === b.id)
          const sp = content.speakers.filter((s) => s.boothId === b.id)
          return (
            <div key={b.id} className="rounded-2xl border border-[#e4ddd0] bg-white p-4">
              <p className="text-[15px]">
                <b>
                  {b.id} · {sp.map((s) => s.nama).join(' & ') || b.nama}
                </b>{' '}
                <span className="text-[#6b6058]">· {v ? `stamped ${fmtTime(v.confirmedAt)}` : 'not stamped'}</span>
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px]">
                {(r?.poin ?? ['', '', '']).map((x, i) => (
                  <li key={i} className={x ? '' : 'text-[#a99a98] italic'}>
                    {x || 'empty'}
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
        <div className="flex flex-wrap gap-x-8 gap-y-1 rounded-2xl border border-[#e4ddd0] bg-white p-4 text-[15px] lg:col-span-2">
          <b>Feedback</b>
          {qs.map((q, i) => {
            const a = p.answers.find((x) => x.questionId === q.id)
            return (
              <span key={q.id}>
                {q.section ? `${q.section.replace(/ · .*/, '')} · ` : ''}
                {q.tipe === 'teks' ? q.teks : `Q${i + 1} ${q.teks}`}: <b>{a?.nilaiInt ? `${a.nilaiInt}/5` : a?.nilaiTeks || '–'}</b>
              </span>
            )
          })}
        </div>
      </div>

      <footer className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-[#e4ddd0] bg-white px-5 py-3">
        <label htmlFor="rev-note" className="sr-only">
          Note for the participant
        </label>
        <input id="rev-note" className="field-paper min-w-[200px] flex-1" placeholder="Note for the participant (required when returning)" value={note} onChange={(e) => setNote(e.target.value)} />
        <label className={`flex min-h-11 items-center gap-2 text-[14px] ${sub?.status === 'approved' ? '' : 'opacity-50'}`} title="Available after approval">
          <input type="checkbox" className="h-5 w-5" checked={s4i ?? p.stamp4it} disabled={sub?.status !== 'approved' || busy === 'approve' || busy === 'revision'} onChange={() => act('s4i')} />
          Stamp4It given
        </label>
        <button type="button" className="btn border-2 border-[#9b2c2c] text-[#9b2c2c]" disabled={!sub || sub.status === 'revision' || !!busy} onClick={() => act('revision')}>
          {busy === 'revision' ? <Spinner /> : 'Return'}
        </button>
        <button type="button" className="btn bg-[#1f7a4a] text-white" disabled={!sub || sub.status !== 'submitted' || !!busy} onClick={() => act('approve')}>
          {busy === 'approve' ? <Spinner /> : 'Approve'}
        </button>
        <div className="w-full">
          <ErrorText>{err}</ErrorText>
        </div>
      </footer>
    </div>
  )
}
