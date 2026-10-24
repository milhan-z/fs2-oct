import { useState, type FormEvent } from 'react'
import { NavLink, Route, Routes } from 'react-router'
import { api, isMock } from '../../data/api'
import { useLive } from '../../app/useAsync'
import { useContent } from '../../app/providers'
import { ErrorText, Spinner } from '../../components/ui'
import { fmtTime, isoToLocalInput, localInputToIso, nowMs, sessionPhase } from '../../data/time'
import { Submissions } from './Submissions'
import { Participants } from './Participants'
import { ContentEditor } from './ContentEditor'
import { exportCsv, exportXlsx } from './exporter'

/** A1–A5 — admin console (desktop-first, still usable on a phone). */
export default function Admin() {
  const [authed, setAuthed] = useState(api.adminHasSession())
  if (!authed) return <AdminLogin onDone={() => setAuthed(true)} />
  return <AdminShell onLogout={() => (api.adminLogout(), setAuthed(false))} />
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.adminLogin(pw)
      onDone()
    } catch (er) {
      setErr((er as Error).message)
      setBusy(false)
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy-2 p-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-paper p-6 text-ink shadow-2xl">
        <p className="font-mono text-[13px] font-bold tracking-[0.3em] text-[#b8861a]">FS² · ADMIN</p>
        <h1 className="mt-1 text-[26px] font-extrabold">Admin sign-in</h1>
        <label htmlFor="admin-pw" className="mt-5 block text-[15px] font-bold">
          Password
        </label>
        <input id="admin-pw" type="password" autoFocus className="field-paper mt-2" value={pw} onChange={(e) => setPw(e.target.value)} />
        <ErrorText>{err}</ErrorText>
        <button type="submit" className="btn btn-red mt-5 w-full" disabled={busy || !pw}>
          {busy ? <Spinner /> : 'Sign in'}
        </button>
        {isMock && <p className="mt-3 text-[13px] text-[#6b6058]">Demo mode (mock). The password is in the DEV panel (?dev=1).</p>}
      </form>
    </main>
  )
}

function AdminShell({ onLogout }: { onLogout: () => void }) {
  const dash = useLive(() => api.adminDashboard(), [], 5000)
  const pending = dash.data?.submissions.submitted ?? 0
  const links = [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/submissions', label: 'Submissions', badge: pending },
    { to: '/admin/participants', label: 'Participants' },
    { to: '/admin/content', label: 'Booths & content' },
    { to: '/admin/settings', label: 'Settings' },
    { to: '/admin/export', label: 'Export' },
  ]
  return (
    <div className="flex min-h-dvh flex-col bg-[#f6f4ef] text-ink md:flex-row">
      <aside className="flex flex-none flex-col bg-navy-2 text-cream md:w-[240px]">
        <p className="px-6 pt-6 font-mono text-[14px] font-bold tracking-[0.3em] text-gold">FS² · ADMIN</p>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-3 md:mt-4 md:flex-col md:overflow-visible" aria-label="Admin menu">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `flex min-h-11 flex-none items-center justify-between gap-3 rounded-xl px-4 text-[15px] whitespace-nowrap ${isActive ? 'bg-white/12 font-bold text-white' : 'text-cream/85 hover:bg-white/5'}`}
            >
              {l.label}
              {!!l.badge && <span className="rounded-full bg-red px-2 py-0.5 text-[12px] font-bold text-white">{l.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={onLogout} className="mx-6 mt-auto mb-5 hidden min-h-11 text-left text-[13px] text-cream/60 underline md:block">
          Sign out
        </button>
      </aside>
      <div className="min-w-0 flex-1">
        <Routes>
          <Route index element={<Summary data={dash.data} />} />
          <Route path="submissions" element={<Submissions onChange={dash.reload} />} />
          <Route path="participants" element={<Participants />} />
          <Route path="content" element={<ContentEditor />} />
          <Route path="settings" element={<SettingsPanel />} />
          <Route path="export" element={<ExportPanel />} />
        </Routes>
      </div>
    </div>
  )
}

function Summary({ data }: { data: Awaited<ReturnType<typeof api.adminDashboard>> | null }) {
  const { content } = useContent()
  if (!data || !content) return <div className="p-8">Loading…</div>
  const max = Math.max(1, ...data.perBooth.map((b) => b.count))
  const phase = sessionPhase(content.settings.sessionStart, content.settings.sessionEnd)
  const cards = [
    ['Registered', data.participants],
    ['With photo', data.withPhoto],
    ['4/4 booths', data.allFour],
    ['Awaiting review', data.submissions.submitted],
    ['Needs revision', data.submissions.revision],
    ['Approved', data.submissions.approved],
    ['Stamp4It given', data.stamp4it],
  ] as const
  return (
    <section className="p-5 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[28px] font-extrabold">Live overview</h1>
        <p className="text-[14px] text-[#6b6058]">
          {fmtTime(new Date(nowMs()).toISOString())} WIB · session {phase === 'open' ? 'running' : phase === 'before' ? 'not started' : 'ended'}
          {content.settings.simulationMode && ' · SIMULATION MODE'}
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-[#e4ddd0] bg-white p-4">
            <p className="text-[13px] text-[#6b6058]">{l}</p>
            <p className="text-[30px] font-extrabold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e4ddd0] bg-white p-5">
          <h2 className="text-[17px] font-bold">Scans per booth</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {data.perBooth.map((b) => (
              <li key={b.boothId}>
                <div className="flex justify-between text-[14px]">
                  <span>
                    {b.boothId} · {b.nama}
                  </span>
                  <b>{b.count}</b>
                </div>
                <div className="mt-1 h-3 rounded-full bg-[#efe9df]">
                  <div className="h-3 rounded-full bg-red transition-all" style={{ width: `${(b.count / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[#e4ddd0] bg-white p-5">
          <h2 className="text-[17px] font-bold">Latest confirmations</h2>
          <ul className="mt-2 divide-y divide-[#efe9df] text-[14px]">
            {data.recent.map((r, i) => (
              <li key={i} className="flex justify-between py-2">
                <span>
                  {r.nama} · <span className="text-[#6b6058]">{r.boothNama}</span>
                </span>
                <span className="font-mono">{fmtTime(r.at)}</span>
              </li>
            ))}
            {!data.recent.length && <li className="py-2 text-[#6b6058]">No scans yet.</li>}
          </ul>
        </div>
      </div>
    </section>
  )
}

function SettingsPanel() {
  const { content, reload } = useContent()
  const [msg, setMsg] = useState('')
  if (!content) return null
  const s = content.settings
  const set = async (patch: Parameters<typeof api.adminSetSettings>[0]) => {
    await api.adminSetSettings(patch)
    reload()
    setMsg('Saved')
    setTimeout(() => setMsg(''), 2000)
  }
  return (
    <section className="max-w-2xl p-5 md:p-8">
      <h1 className="text-[28px] font-extrabold">Settings</h1>
      <div className="mt-5 rounded-2xl border border-[#e4ddd0] bg-white p-5">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-6 w-6" checked={s.simulationMode} onChange={(e) => set({ simulationMode: e.target.checked })} />
          <span>
            <b className="text-[17px]">Simulation mode</b>
            <span className="block text-[14px] text-[#6b6058]">Booth scanning works outside the session hours — for the committee rehearsal on Tue 27 Oct. Turn it off before the event.</span>
          </span>
        </label>
      </div>
      <div className="mt-4 grid gap-4 rounded-2xl border border-[#e4ddd0] bg-white p-5 sm:grid-cols-2">
        {(
          [
            ['sessionStart', 'Booth session starts'],
            ['sessionEnd', 'Booth session ends'],
            ['deadline', 'Submission deadline'],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="flex flex-col gap-1.5">
            <label htmlFor={`set-${k}`} className="text-[14px] font-bold">
              {label} (WIB)
            </label>
            <input id={`set-${k}`} type="datetime-local" className="field-paper" defaultValue={isoToLocalInput(s[k])} onBlur={(e) => e.target.value && set({ [k]: localInputToIso(e.target.value) })} />
          </div>
        ))}
      </div>
      {msg && <p className="mt-3 font-bold text-[#2e7d32]">{msg}</p>}
    </section>
  )
}

function ExportPanel() {
  const [busy, setBusy] = useState<'' | 'xlsx' | 'csv'>('')
  const run = async (kind: 'xlsx' | 'csv') => {
    setBusy(kind)
    try {
      const data = await api.adminExport()
      if (kind === 'xlsx') await exportXlsx(data)
      else await exportCsv(data)
    } finally {
      setBusy('')
    }
  }
  return (
    <section className="max-w-2xl p-5 md:p-8">
      <h1 className="text-[28px] font-extrabold">Export</h1>
      <p className="mt-2 text-[15px] text-[#6b6058]">
        Same layout as a Google Form result. The XLSX has the tabs <b>Respons</b> (one row per submission), <b>Kunjungan</b> (scan log) and <b>Peserta</b>. The CSV is the Respons tab. No PINs, tokens or photo links.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn bg-[#1f7a4a] text-white" onClick={() => run('xlsx')} disabled={!!busy}>
          {busy === 'xlsx' ? <Spinner /> : 'Download XLSX'}
        </button>
        <button type="button" className="btn border-2 border-navy text-navy" onClick={() => run('csv')} disabled={!!busy}>
          {busy === 'csv' ? <Spinner /> : 'Download CSV'}
        </button>
      </div>
    </section>
  )
}
