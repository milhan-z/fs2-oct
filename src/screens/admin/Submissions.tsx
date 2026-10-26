import { useEffect, useMemo, useState } from 'react'
import { api } from '../../data/api'
import { useLive } from '../../app/useAsync'
import { useContent } from '../../app/providers'
import type { AdminSubmissionRow, SubmissionStatus } from '../../data/types'
import { fmtTime } from '../../data/time'
import { Loading, ErrorText, Spinner } from '../../components/ui'

type Filter = SubmissionStatus | 'all'

const TABS: [Filter, string][] = [
  ['submitted', 'Waiting'],
  ['revision', 'Needs revision'],
  ['approved', 'Approved'],
  ['all', 'All'],
]

const BADGE: Record<SubmissionStatus, string> = {
  submitted: 'bg-[#fff1c2] text-[#7a5a00]',
  revision: 'bg-[#fde2e2] text-[#9b2c2c]',
  approved: 'bg-[#e3f3e6] text-[#2e7d32]',
}
const BADGE_LABEL: Record<SubmissionStatus, string> = { submitted: 'Waiting', revision: 'Needs revision', approved: 'Approved' }

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold ${ok ? 'bg-[#e3f3e6] text-[#2e7d32]' : 'bg-[#fde2e2] text-[#9b2c2c]'}`}>
      <span aria-hidden="true">{ok ? '✓' : '✗'}</span>
      {label}
    </span>
  )
}

/**
 * A2 — every submission in one list: completeness at a glance, Approve / Return / Stamp4It right on the row,
 * bulk approve, and a click on the name for the full review.
 */
export function Submissions({ onChange }: { onChange: () => void }) {
  const { content } = useContent()
  const [tab, setTab] = useState<Filter>('submitted')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [returning, setReturning] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')
  const [s4i, setS4i] = useState<Record<string, boolean>>({}) // ticked at once, before the server answers
  const list = useLive(() => api.adminListSubmissions('all', ''), [], 8000)

  const need = content ? Math.min(content.rules.jumlah_booth_wajib, content.booths.length) : 4
  const rows = useMemo(() => list.data ?? [], [list.data])
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { submitted: 0, revision: 0, approved: 0, all: rows.length }
    for (const r of rows) c[r.status]++
    return c
  }, [rows])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => (tab === 'all' || r.status === tab) && (!needle || [r.nama, r.nrp, r.departemen, r.code].some((v) => v.toLowerCase().includes(needle))))
  }, [rows, tab, q])
  const pickable = shown.filter((r) => r.status === 'submitted')
  const chosen = pickable.filter((r) => picked.has(r.submissionId))

  const refresh = () => {
    list.reload()
    onChange()
  }
  const run = async (ids: string[], job: () => Promise<void>) => {
    setErr('')
    setBusy((b) => new Set([...b, ...ids]))
    try {
      await job()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy((b) => new Set([...b].filter((x) => !ids.includes(x))))
      refresh()
    }
  }
  const approve = (r: AdminSubmissionRow) => run([r.submissionId], () => api.adminReview(r.submissionId, 'approve', ''))
  const sendBack = (r: AdminSubmissionRow) => {
    if (!note.trim()) return setErr('Write a note for the participant before returning it.')
    const text = note.trim()
    setReturning(null)
    setNote('')
    run([r.submissionId], () => api.adminReview(r.submissionId, 'revision', text))
  }
  const stamp = (r: AdminSubmissionRow) => {
    const next = !(s4i[r.submissionId] ?? r.stamp4it)
    setS4i((m) => ({ ...m, [r.submissionId]: next }))
    run([r.submissionId], () => api.adminSetStamp4it(r.participantId, next)).finally(() => setS4i((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== r.submissionId))))
  }
  const approveChosen = async () => {
    if (!chosen.length || !confirm(`Approve ${chosen.length} submission${chosen.length > 1 ? 's' : ''}?`)) return
    const ids = chosen.map((r) => r.submissionId)
    setPicked(new Set())
    await run(ids, async () => {
      for (const id of ids) await api.adminReview(id, 'approve', '')
    })
  }
  const toggle = (id: string) => setPicked((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))

  if (sel) return <Detail pid={sel} onBack={() => setSel(null)} onChange={refresh} />

  return (
    <section className="p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-extrabold">Submissions</h1>
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => (setTab(k), setPicked(new Set()))}
              className={`min-h-10 rounded-full border px-4 text-[14px] ${tab === k ? 'border-navy bg-navy font-bold text-white' : 'border-[#d5cabd] bg-white'}`}
            >
              {l} <span className={tab === k ? 'text-white/80' : 'text-[#6b6058]'}>{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[14px] text-[#6b6058]">
        Everyone in one list. A submission can only be sent once {need} booths, their notes and the required feedback are complete; the ticks show it. Click a name for the full review.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="sub-q" className="sr-only">
          Search
        </label>
        <input id="sub-q" className="field-paper max-w-sm" placeholder="Search name, NRP, department or code" value={q} onChange={(e) => setQ(e.target.value)} />
        {pickable.length > 0 && (
          <>
            <label className="flex min-h-11 items-center gap-2 text-[14px]">
              <input type="checkbox" className="h-5 w-5" checked={chosen.length === pickable.length} onChange={(e) => setPicked(e.target.checked ? new Set(pickable.map((r) => r.submissionId)) : new Set())} />
              Select all waiting ({pickable.length})
            </label>
            <button type="button" className="btn min-h-11 bg-[#1f7a4a] px-4 text-white disabled:opacity-40" disabled={!chosen.length} onClick={approveChosen}>
              Approve selected{chosen.length ? ` (${chosen.length})` : ''}
            </button>
          </>
        )}
      </div>
      <div className="mt-2">
        <ErrorText>{err}</ErrorText>
      </div>

      {!list.data ? (
        <Loading dark={false} />
      ) : (
        <ul className="mt-3 overflow-hidden rounded-2xl border border-[#e4ddd0] bg-white">
          {shown.map((r) => {
            const working = busy.has(r.submissionId)
            return (
              <li key={r.submissionId} className="border-b border-[#efe9df] last:border-b-0">
                <div className="grid items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[28px_minmax(190px,1.2fr)_minmax(260px,1.6fr)_auto]">
                  <div className="hidden md:block">
                    {r.status === 'submitted' && <input type="checkbox" className="h-5 w-5" aria-label={`Select ${r.nama}`} checked={picked.has(r.submissionId)} onChange={() => toggle(r.submissionId)} />}
                  </div>
                  <div className="min-w-0">
                    <button type="button" onClick={() => setSel(r.participantId)} className="block max-w-full truncate text-left text-[16px] font-bold underline-offset-4 hover:underline">
                      {r.nama}
                    </button>
                    <p className="truncate text-[13px] text-[#6b6058]">
                      {r.nrp} · {r.departemen} · {r.angkatan}
                    </p>
                    <p className="font-mono text-[12px] text-[#6b6058]">
                      {r.code} · {fmtTime(r.submittedAt)}
                      {r.version > 1 ? ' · resubmitted' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Check ok={r.boothCount >= need} label={`Stamps ${Math.min(r.boothCount, need)}/${need}`} />
                    <Check ok={r.notesDone >= need} label={`Notes ${Math.min(r.notesDone, need)}/${need}`} />
                    <Check ok={r.feedbackDone >= r.feedbackRequired} label={`Feedback ${r.feedbackDone}/${r.feedbackRequired}`} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${BADGE[r.status]}`}>{BADGE_LABEL[r.status]}</span>
                    {r.status === 'approved' && (
                      <label className="flex min-h-11 items-center gap-2 text-[14px]">
                        <input type="checkbox" className="h-5 w-5" checked={s4i[r.submissionId] ?? r.stamp4it} onChange={() => stamp(r)} />
                        Stamp4It
                      </label>
                    )}
                    {r.status === 'submitted' && (
                      <button type="button" className="btn min-h-11 bg-[#1f7a4a] px-4 text-white" disabled={working} onClick={() => approve(r)}>
                        {working ? <Spinner /> : 'Approve'}
                      </button>
                    )}
                    {r.status !== 'revision' && (
                      <button
                        type="button"
                        className="btn min-h-11 border-2 border-[#9b2c2c] px-4 text-[#9b2c2c]"
                        disabled={working}
                        onClick={() => (setReturning(returning === r.submissionId ? null : r.submissionId), setNote(r.reviewerNote ?? ''), setErr(''))}
                      >
                        Return
                      </button>
                    )}
                    <button type="button" className="min-h-11 px-2 text-[14px] underline" onClick={() => setSel(r.participantId)}>
                      Review
                    </button>
                  </div>
                </div>
                {r.status === 'revision' && r.reviewerNote && <p className="px-4 pb-3 text-[13px] text-[#9b2c2c]">Note sent: {r.reviewerNote}</p>}
                {returning === r.submissionId && (
                  <div className="flex flex-wrap items-center gap-2 bg-[#faf8f4] px-4 py-3">
                    <label htmlFor={`ret-${r.submissionId}`} className="sr-only">
                      Note for the participant
                    </label>
                    <input
                      id={`ret-${r.submissionId}`}
                      className="field-paper min-w-[220px] flex-1"
                      placeholder={`What should ${r.nama.split(' ')[0]} fix?`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendBack(r)}
                      autoFocus
                    />
                    <button type="button" className="btn min-h-11 bg-[#9b2c2c] px-4 text-white" onClick={() => sendBack(r)}>
                      Send back
                    </button>
                    <button type="button" className="min-h-11 px-2 underline" onClick={() => setReturning(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            )
          })}
          {!shown.length && <li className="px-5 py-6 text-[14px] text-[#6b6058]">No submissions here.</li>}
        </ul>
      )}
    </section>
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
    <div className="flex min-h-dvh flex-col bg-[#f6f4ef]">
      <header className="flex items-center gap-4 border-b border-[#e4ddd0] bg-white px-5 py-4">
        <button type="button" onClick={onBack} className="min-h-11 text-[14px] underline">
          ← All submissions
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
