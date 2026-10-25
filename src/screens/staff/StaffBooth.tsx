import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import QrScanner from 'qr-scanner'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useContent } from '../../app/providers'
import { useLive } from '../../app/useAsync'
import { api, isMock } from '../../data/api'
import { mockDev } from '../../data/mockAdapter'
import type { ResolvedToken, StaffSession } from '../../data/types'
import { fmtTime, relTime, sessionPhase } from '../../data/time'
import { ErrorText, Loading, Spinner, Toast } from '../../components/ui'
import { Icon } from '../../components/decor'
import { EASE_OUT } from '../../motion/presets'
import { vibrate } from '../../app/sound'
import { onBackground, releaseVideo } from '../../app/camera'
import { CameraPrimer, cameraNeedsPrimer, describeCameraError, markCameraPrimerSeen } from '../../components/CameraPrimer'

/** S1 — staff PIN (shared or booth), then S2 scanner / S3 history. Runners switch booths freely. */
export default function StaffBooth() {
  const { slug = '' } = useParams()
  const { content } = useContent()
  const [session, setSession] = useState<StaffSession | null>(() => api.staffSession(slug))
  const [switching, setSwitching] = useState(() => !api.staffSession(slug) && api.staffCanSwitch())

  // signed in with the shared PIN: open this booth without asking again
  useEffect(() => {
    const s = api.staffSession(slug)
    setSession(s)
    if (s || !api.staffCanSwitch()) return setSwitching(false)
    setSwitching(true)
    let live = true
    api
      .staffSwitch(slug)
      .then((r) => live && setSession(r))
      .catch(() => {})
      .finally(() => live && setSwitching(false))
    return () => {
      live = false
    }
  }, [slug])

  if (!content || switching) return <Loading />
  const booth = content.booths.find((b) => b.slug === slug)
  return (
    <main key={slug} className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-[#111318] text-cream">
      {!booth ? (
        <p className="p-6">Booth not found. Check the link from the committee.</p>
      ) : session ? (
        <Scanner slug={slug} session={session} onLogout={() => (api.staffLogout(slug), setSession(null))} />
      ) : (
        <StaffLogin slug={slug} boothNama={booth.nama} onDone={setSession} />
      )}
    </main>
  )
}

function StaffLogin({ slug, boothNama, onDone }: { slug: string; boothNama: string; onDone: (s: StaffSession | null) => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      onDone(await api.staffLogin(slug, pin))
    } catch (er) {
      setErr((er as Error).message)
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col px-5 pt-10 pb-8">
      <p className="text-[14px] text-muted">Officer · {boothNama} booth</p>
      <h1 className="text-[30px] font-extrabold text-white">Enter the staff PIN</h1>
      <label htmlFor="staff-pin" className="mt-6 text-[15px] font-bold">
        Staff PIN
      </label>
      <input
        id="staff-pin"
        className="field mt-2 tracking-[0.6em]"
        type="password"
        inputMode="numeric"
        maxLength={6}
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
      />
      <ErrorText>{err}</ErrorText>
      <p className="mt-2 text-[14px] text-muted">The shared staff PIN works for every booth. The committee gives it to staff and runners.</p>
      <button type="submit" className="btn mt-auto w-full bg-[#1f7a4a] text-white disabled:bg-[#2a3530] disabled:text-[#7d8a83]" disabled={busy || pin.length < 4}>
        {busy ? <Spinner /> : 'Sign in'}
      </button>
    </form>
  )
}

interface QueueItem extends ResolvedToken {
  key: string
  addedAt: string
}

const queueKey = (slug: string) => `fs2.staffQueue.${slug}`

function Scanner({ slug, session, onLogout }: { slug: string; session: StaffSession; onLogout: () => void }) {
  const reduce = useReducedMotion()
  const { content } = useContent()
  const [tab, setTab] = useState<'scan' | 'history'>('scan')
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    try {
      return (JSON.parse(sessionStorage.getItem(queueKey(slug)) ?? '[]') as QueueItem[]).filter((q) => q.kind === 'ok')
    } catch {
      return []
    }
  })
  const [toast, setToast] = useState<{ m: string; tone: 'ok' | 'warn' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState(false)
  const [camState, setCamState] = useState<'starting' | 'on' | 'error'>('starting')
  const [camMsg, setCamMsg] = useState('')
  const [camTry, setCamTry] = useState(0)
  // 'primer' = the explanation shows first (once per device); the scanner starts only after Continue
  const [camGate, setCamGate] = useState<'checking' | 'primer' | 'go'>('checking')
  useEffect(() => {
    if (tab !== 'scan') return
    let live = true
    cameraNeedsPrimer().then((need) => live && setCamGate(need ? 'primer' : 'go'))
    return () => {
      live = false
    }
  }, [tab])
  const [, tick] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSeen = useRef(new Map<string, number>())
  const queueRef = useRef(queue)
  const [frameScope, animateFrame] = useAnimate()
  const history = useLive(() => api.staffHistory(slug), [slug], 5000)
  // expired officer session → back to the PIN screen
  const expired = (history.error as { code?: string } | null)?.code === 'auth'
  useEffect(() => {
    if (expired) onLogout()
  }, [expired, onLogout])

  useEffect(() => {
    queueRef.current = queue
    sessionStorage.setItem(queueKey(slug), JSON.stringify(queue))
  }, [queue, slug])

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  const flashFrame = useCallback(
    (color: string) => {
      if (frameScope.current && !reduce) animateFrame(frameScope.current, { borderColor: [color, '#4ade80'], scale: [1.04, 1] }, { duration: 0.25 })
    },
    [animateFrame, frameScope, reduce],
  )

  const addResolved = useCallback(
    (r: ResolvedToken) => {
      const exists = queueRef.current.some((q) => q.participantId && q.participantId === r.participantId)
      if (exists) return flashFrame('#F9B018')
      const item: QueueItem = { ...r, key: `${r.token}-${Date.now()}`, addedAt: new Date().toISOString() }
      setQueue((q) => [item, ...q])
      vibrate(r.kind === 'ok' ? 40 : [60, 40, 60])
      flashFrame(r.kind === 'ok' ? '#86efac' : r.kind === 'duplicate' ? '#F9B018' : '#ef4444')
      if (r.kind !== 'ok') setTimeout(() => setQueue((q) => q.filter((x) => x.key !== item.key)), r.kind === 'unknown' ? 4000 : 6000)
    },
    [flashFrame],
  )

  const onToken = useCallback(
    async (data: string) => {
      const now = Date.now()
      if ((lastSeen.current.get(data) ?? 0) > now - 3000) return // debounce per token 3s
      lastSeen.current.set(data, now)
      if (!/^FS2:/.test(data)) return addResolved({ token: data, kind: 'unknown' })
      try {
        const [r] = await api.staffResolveTokens(slug, [data])
        addResolved(r)
      } catch (e) {
        setToast({ m: (e as Error).message, tone: 'warn' })
      }
    },
    [slug, addResolved],
  )

  // camera: continuous scan, back camera (qr-scanner works on iOS Safari). It is switched off whenever the tab is
  // left, the page is hidden (home screen, another app, locked phone) or the screen closes, and back on when visible.
  useEffect(() => {
    const video = videoRef.current
    if (tab !== 'scan' || !video || camGate !== 'go') return
    let scanner: QrScanner | null = null
    let alive = true
    const turnOn = () => {
      if (!alive || scanner) return
      setCamState('starting')
      setCamMsg('')
      const s = new QrScanner(video, (res) => onToken(res.data), {
        preferredCamera: 'environment',
        maxScansPerSecond: 8,
        returnDetailedScanResult: true,
        highlightScanRegion: false,
        highlightCodeOutline: false,
      })
      scanner = s
      s.start()
        .then(() => alive && scanner === s && setCamState('on'))
        .catch((e) => {
          if (!alive) return
          scanner = null
          setCamState('error')
          setCamMsg(describeCameraError(e))
        })
    }
    const turnOff = () => {
      const s = scanner
      scanner = null
      s?.stop()
      s?.destroy()
      releaseVideo(video) // the light goes out even if the scanner was still starting
    }
    // started on the next tick: React's development double-mount then never creates (and tears down) a first scanner
    const first = window.setTimeout(turnOn, 0)
    const unsub = onBackground(turnOff, turnOn)
    return () => {
      alive = false
      clearTimeout(first)
      unsub()
      turnOff()
    }
  }, [tab, onToken, camGate, camTry])

  const phase = content ? sessionPhase(content.settings.sessionStart, content.settings.sessionEnd) : 'open'
  const open = !!content && (content.settings.simulationMode || phase === 'open')
  const okItems = queue.filter((q) => q.kind === 'ok')

  const confirmAll = async () => {
    setBusy(true)
    try {
      const n = await api.staffConfirmBatch(
        slug,
        okItems.map((q) => q.participantId!),
      )
      // sweep entries out to the right one by one (stagger 40ms)
      for (const [i, q] of okItems.entries()) setTimeout(() => setQueue((cur) => cur.filter((x) => x.key !== q.key)), reduce ? 0 : i * 40)
      setToast({ m: `${n} visit${n === 1 ? '' : 's'} confirmed`, tone: 'ok' })
      history.reload()
    } catch (e) {
      setToast({ m: (e as Error).message, tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-5 pb-5">
      <div className="flex items-start justify-between px-1">
        <div>
          <BoothSwitch slug={slug} boothNama={session.boothNama} />
          <h1 className="text-[26px] font-extrabold text-white">{tab === 'scan' ? 'Rapid scan' : 'History'}</h1>
        </div>
        <div className="text-right">
          <p className="text-[28px] leading-none font-extrabold text-white">{history.data?.length ?? '–'}</p>
          <p className="text-[12px] text-muted">confirmed</p>
        </div>
      </div>

      <div role="tablist" className="mt-3 grid grid-cols-2 rounded-full bg-black/40 p-1">
        {(['scan', 'history'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-11 rounded-full text-[15px] font-bold ${tab === t ? 'bg-[#2c313c] text-white' : 'text-muted'}`}>
            {t === 'scan' ? 'Scan' : 'History & undo'}
          </button>
        ))}
      </div>

      {!open && (
        <p className="mt-3 rounded-xl border border-yellow/50 bg-[#2e2611] px-4 py-3 text-[14px] text-yellow" role="status">
          {phase === 'before' ? `The booth session has not started (opens ${fmtTime(content!.settings.sessionStart)} WIB).` : 'The booth session has ended.'} Confirming is disabled unless the admin turns on simulation mode.
        </p>
      )}
      {content?.settings.simulationMode && <p className="mt-3 rounded-xl bg-[#1e3a5f] px-4 py-2 text-[13px] text-[#bfdbfe]">Simulation mode is on — test data.</p>}

      {tab === 'scan' ? (
        <>
          {camGate === 'primer' && (
            <CameraPrimer
              title="Scan visitors’ QR codes"
              body="The booth scanner uses the back camera to read each passport QR. Nothing is recorded, and it switches off when you leave this tab."
              onContinue={() => {
                markCameraPrimerSeen()
                setCamGate('go')
              }}
            />
          )}
          <div className="relative mt-3 overflow-hidden rounded-[22px] bg-[#1b1f27]">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline aria-label="Scanner camera" />
            <p className={`absolute top-3 left-4 text-[14px] font-bold ${camState === 'on' ? 'text-[#4ade80]' : 'text-yellow'}`}>
              ● {camState === 'on' ? 'Camera on · keep scanning' : camState === 'starting' ? 'Starting camera…' : 'Camera unavailable — use manual entry'}
            </p>
            {camState === 'error' && (
              <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 text-center">
                <p className="text-[13px] leading-snug text-cream/90">{camMsg}</p>
                <button type="button" className="btn btn-cream min-h-11" onClick={() => setCamTry((n) => n + 1)}>
                  Try again
                </button>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <motion.div ref={frameScope} className="aspect-square w-[46%] rounded-[18px] border-[5px] border-[#4ade80] shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            </div>
            <p className="absolute inset-x-0 bottom-2 text-center text-[13px] text-cream/90">Point at the next QR — no need to tap anything</p>
          </div>

          <div className="mt-4 flex items-baseline justify-between px-1">
            <h2 className="text-[19px] font-extrabold text-white">Confirmation queue</h2>
            <span className="text-[14px] text-muted">{okItems.length} in queue</span>
          </div>
          <ul className="mt-2 flex flex-col gap-2" aria-live="polite">
            <AnimatePresence initial={false}>
              {queue.map((q, i) => (
                <motion.li
                  key={q.key}
                  layout
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24 }}
                  animate={q.kind === 'duplicate' && !reduce ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] } : { opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 320 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className={`flex items-center gap-3 rounded-[16px] border p-3 ${
                    q.kind === 'ok' ? (i === 0 ? 'border-[#4ade80] bg-[#1b1f27]' : 'border-[#2c313c] bg-[#1b1f27]') : q.kind === 'duplicate' ? 'border-[#b8901a] bg-[#2e2611]' : 'border-[#b33] bg-[#3a1515]'
                  }`}
                >
                  {q.kind === 'ok' ? (
                    <div className="w-12 flex-none bg-[#f4efe4] p-[3px] pb-[9px]">
                      <div className="aspect-square bg-gradient-to-b from-[#4a505c] to-[#2a2e36]">{q.photo && <img src={q.photo} alt="" className="h-full w-full object-cover" />}</div>
                    </div>
                  ) : (
                    <span className={`flex w-12 flex-none justify-center text-[24px] font-extrabold ${q.kind === 'duplicate' ? 'text-yellow' : 'text-[#f87171]'}`}>!</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-extrabold text-white">{q.nama ?? 'Unknown QR'}</p>
                    <p className={`text-[14px] ${q.kind === 'ok' ? 'text-muted' : q.kind === 'duplicate' ? 'text-yellow' : 'text-[#fca5a5]'}`}>
                      {q.kind === 'ok' ? `${q.nrpMasked} · ${relTime(q.addedAt, Date.now())}` : q.kind === 'duplicate' ? 'Already stamped at this booth · ignored' : 'Not an FS² passport QR'}
                    </p>
                  </div>
                  {q.kind === 'ok' && (
                    <button type="button" aria-label={`Remove ${q.nama} from the queue`} onClick={() => setQueue((cur) => cur.filter((x) => x.key !== q.key))} className="flex h-12 w-14 flex-none items-center justify-center rounded-xl border border-[#3a404c]">
                      <Icon.Close className="h-5 w-5" />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
            {!queue.length && <li className="rounded-[16px] border border-dashed border-[#2c313c] p-4 text-center text-[14px] text-muted">Queue is empty. Scan a participant QR.</li>}
          </ul>

          <div className="mt-auto flex flex-col gap-2.5 pt-5">
            <button type="button" onClick={confirmAll} disabled={!okItems.length || busy || !open} className="btn min-h-[60px] w-full bg-[#1f7a4a] text-[20px] text-white disabled:bg-[#2a3530] disabled:text-[#7d8a83]">
              {busy ? <Spinner /> : `Confirm all (${okItems.length})`}
            </button>
            <button type="button" onClick={() => setManual(true)} className="btn btn-ghost w-full">
              Manual entry (last 4 NRP digits)
            </button>
            {isMock && sessionStorage.getItem('fs2.dev') === '1' && (
              <button
                type="button"
                className="min-h-11 rounded-xl bg-[#1e3a5f] text-[14px] font-semibold text-[#bfdbfe]"
                onClick={() => {
                  const t = mockDev.randomToken(session.boothId)
                  if (t) onToken(t)
                  else setToast({ m: 'No other participants — add dummies from the DEV panel', tone: 'warn' })
                }}
              >
                DEV: simulate a participant QR scan
              </button>
            )}
            <button type="button" onClick={onLogout} className="min-h-11 text-[13px] text-muted underline">
              Leave officer mode
            </button>
          </div>
        </>
      ) : (
        <History slug={slug} items={history.data} reload={history.reload} onToast={(m) => setToast({ m, tone: 'ok' })} />
      )}

      {manual && <ManualInput slug={slug} onClose={() => setManual(false)} onPick={(r) => (addResolved(r), setManual(false))} />}
      <Toast message={toast?.m ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </div>
  )
}

function ManualInput({ slug, onClose, onPick }: { slug: string; onClose: () => void; onPick: (r: ResolvedToken) => void }) {
  const [last4, setLast4] = useState('')
  const [res, setRes] = useState<ResolvedToken[] | null>(null)
  const [busy, setBusy] = useState(false)
  const find = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setRes(await api.staffFindByLast4(slug, last4).catch(() => []))
    setBusy(false)
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="manual-title" onClick={onClose}>
      <motion.form
        onSubmit={find}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-[480px] rounded-t-[24px] bg-[#1b1f27] p-5 pb-8"
      >
        <h2 id="manual-title" className="text-[20px] font-extrabold text-white">
          Manual entry
        </h2>
        <p className="text-[14px] text-muted">For a dead phone or unreadable QR. Match the photo & name.</p>
        <label htmlFor="last4" className="mt-4 block text-[15px] font-bold">
          Last 4 digits of NRP
        </label>
        <div className="mt-2 flex gap-2">
          <input id="last4" className="field" inputMode="numeric" maxLength={4} autoFocus value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} />
          <button type="submit" className="btn bg-[#2c313c] text-white" disabled={last4.length !== 4 || busy}>
            Search
          </button>
        </div>
        <ul className="mt-3 flex max-h-[40dvh] flex-col gap-2 overflow-y-auto">
          {res?.map((r) => (
            <li key={r.token}>
              <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 rounded-xl border border-[#3a404c] p-3 text-left">
                <div className="w-11 flex-none bg-[#f4efe4] p-[3px] pb-[8px]">
                  <div className="aspect-square bg-[#3a3f4a]">{r.photo && <img src={r.photo} alt="" className="h-full w-full object-cover" />}</div>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{r.nama}</p>
                  <p className="text-[13px] text-muted">
                    {r.nrpMasked}
                    {r.kind === 'duplicate' && <span className="text-yellow"> · already stamped</span>}
                  </p>
                </div>
                <span className="text-[14px] font-bold text-[#4ade80]">Add</span>
              </button>
            </li>
          ))}
          {res && !res.length && <li className="text-[14px] text-muted">No participant with an NRP ending in {last4}.</li>}
        </ul>
        <button type="button" onClick={onClose} className="btn btn-ghost mt-4 w-full">
          Close
        </button>
      </motion.form>
    </div>
  )
}

function History({ slug, items, reload, onToast }: { slug: string; items: Awaited<ReturnType<typeof api.staffHistory>> | null; reload: () => void; onToast: (m: string) => void }) {
  const [q, setQ] = useState('')
  if (!items) return <Loading />
  const list = items.filter((i) => !q || i.nama.toLowerCase().includes(q.toLowerCase()) || i.nrpMasked.endsWith(q))
  const cancel = async (id: string, nama: string) => {
    if (!confirm(`Undo the visit of ${nama}? The stamp will disappear from their passport.`)) return
    await api.staffCancelVisit(slug, id)
    onToast(`Visit of ${nama} undone`)
    reload()
  }
  return (
    <div className="mt-4 flex flex-col">
      <label htmlFor="hist-q" className="sr-only">
        Search history
      </label>
      <input id="hist-q" className="field" placeholder="Search name / last 4 NRP digits" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-3 flex flex-col gap-2">
        {list.map((h) => (
          <li key={h.visitId} className="flex items-center gap-3 rounded-[16px] border border-[#2c313c] bg-[#1b1f27] p-3">
            <div className="w-11 flex-none bg-[#f4efe4] p-[3px] pb-[8px]">
              <div className="aspect-square bg-[#3a3f4a]">{h.photo && <img src={h.photo} alt="" className="h-full w-full object-cover" />}</div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">{h.nama}</p>
              <p className="text-[13px] text-muted">
                {h.nrpMasked} · {fmtTime(h.confirmedAt)}
              </p>
            </div>
            <button type="button" onClick={() => cancel(h.visitId, h.nama)} className="min-h-11 rounded-xl border border-[#7a3a3a] px-3 text-[14px] font-bold text-[#fca5a5]">
              Undo
            </button>
          </li>
        ))}
        {!list.length && <li className="p-4 text-center text-[14px] text-muted">No confirmed visits yet.</li>}
      </ul>
    </div>
  )
}

/** Booth picker in the scanner header (shared-PIN sessions only). */
function BoothSwitch({ slug, boothNama }: { slug: string; boothNama: string }) {
  const { content } = useContent()
  const nav = useNavigate()
  if (!api.staffCanSwitch() || !content) return <p className="text-[13px] text-muted">Officer · {boothNama} booth</p>
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="booth-switch" className="text-[13px] text-muted">
        Booth
      </label>
      <select
        id="booth-switch"
        value={slug}
        onChange={(e) => nav(`/staff/${e.target.value}`)}
        className="min-h-9 rounded-lg border border-[#2c313c] bg-[#1b1f27] px-2 text-[16px] font-semibold text-white"
      >
        {[...content.booths]
          .sort((a, b) => a.sort - b.sort)
          .map((b) => (
            <option key={b.id} value={b.slug}>
              {b.nama}
            </option>
          ))}
      </select>
      <Link to="/staff" className="sr-only">
        All booths
      </Link>
    </div>
  )
}
