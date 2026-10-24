import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { api, isMock } from '../data/api'
import { MOCK_ADMIN_PASSWORD, MOCK_STAFF_PINS, mockDev } from '../data/mockAdapter'
import { fmtTime, getTimeOffset, nowMs, setTimeOffset } from '../data/time'
import { useContent } from '../app/providers'

const FLAG = 'fs2.dev'

/**
 * Hidden demo panel (mock mode only). Open with `?dev=1`; stays available for the tab session.
 * Lets the presenter simulate booth officers, jump in time and reset data.
 */
export function DevPanel() {
  const loc = useLocation()
  const nav = useNavigate()
  const { content } = useContent()
  const [enabled, setEnabled] = useState(() => sessionStorage.getItem(FLAG) === '1')
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [, tick] = useState(0)

  useEffect(() => {
    const p = new URLSearchParams(loc.search)
    if (p.get('dev') === '1') {
      sessionStorage.setItem(FLAG, '1')
      setEnabled(true)
    } else if (p.get('dev') === '0') {
      sessionStorage.removeItem(FLAG)
      setEnabled(false)
    }
  }, [loc.search])

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    const on = () => tick((n) => n + 1)
    window.addEventListener('fs2-mock-change', on)
    return () => {
      clearInterval(t)
      window.removeEventListener('fs2-mock-change', on)
    }
  }, [])

  if (!isMock || !enabled || !content) return null
  const s = mockDev.settings()
  const loggedIn = api.hasSession()

  const jump = (iso: string | null) => {
    setTimeOffset(iso ? new Date(iso).getTime() - Date.now() : 0)
    setMsg(iso ? `Time → ${fmtTime(iso)} WIB` : 'Real time')
  }
  const at = (base: string, minutes: number) => new Date(new Date(base).getTime() + minutes * 60000).toISOString()

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 2500)
  }

  const btn = 'min-h-10 rounded-lg bg-white/10 px-3 text-[13px] font-semibold hover:bg-white/20'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed top-[38%] left-0 z-[100] rounded-r-md bg-[#2b6cb0]/80 px-1.5 py-2 font-mono text-[10px] font-bold text-white shadow-lg [writing-mode:vertical-rl]"
        aria-expanded={open}
      >
        DEV
      </button>
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-[12%] left-8 z-[100] max-h-[85dvh] w-[min(340px,calc(100vw-16px))] overflow-y-auto rounded-xl border border-white/15 bg-[#10131c]/97 p-3 text-[13px] text-white shadow-2xl"
            aria-label="Dev panel"
          >
            <p className="font-mono text-[11px] text-white/60">MOCK MODE · data lives in this browser only</p>

            <h3 className="mt-3 font-bold">Time (now {fmtTime(new Date(nowMs()).toISOString())} WIB{getTimeOffset() ? ', shifted' : ''})</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" className={btn} onClick={() => jump(null)}>Real</button>
              <button type="button" className={btn} onClick={() => jump(at(s.sessionStart, -20))}>Before session</button>
              <button type="button" className={btn} onClick={() => jump(at(s.sessionStart, 28))}>During session</button>
              <button type="button" className={btn} onClick={() => jump(at(s.sessionEnd, 15))}>After session</button>
              <button type="button" className={btn} onClick={() => jump(at(s.deadline, 5))}>Past deadline</button>
            </div>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={s.simulationMode} onChange={(e) => mockDev.setSimulation(e.target.checked)} className="h-5 w-5" />
              Simulation mode (scanning open any time)
            </label>

            <h3 className="mt-3 font-bold">Simulate officer → signed-in participant</h3>
            {loggedIn ? (
              <>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {content.booths.map((b) => (
                    <button key={b.id} type="button" className={btn} onClick={() => flash(`${b.nama}: ${mockDev.confirmCurrent(b.id)}`)}>
                      Stamp {b.id}
                    </button>
                  ))}
                </div>
                <button type="button" className={`${btn} mt-1.5`} onClick={() => (mockDev.fillResumes(), flash('Notes filled for stamped booths'))}>
                  Auto-fill notes
                </button>
              </>
            ) : (
              <p className="text-white/60">Sign in as a participant first.</p>
            )}

            <h3 className="mt-3 font-bold">Data</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" className={btn} onClick={() => (mockDev.seedDummies(12), flash('12 dummy participants added'))}>
                + 12 dummy participants
              </button>
              <button
                type="button"
                className={`${btn} bg-red-700/60`}
                onClick={() => {
                  if (!confirm('Delete all demo data in this browser?')) return
                  mockDev.reset()
                  sessionStorage.setItem(FLAG, '1')
                  nav('/', { replace: true })
                  location.reload()
                }}
              >
                Reset everything
              </button>
            </div>

            <h3 className="mt-3 font-bold">Demo access</h3>
            <ul className="mt-1 space-y-1 text-white/85">
              <li>
                Admin: <Link className="underline" to="/admin">/admin</Link> · password <code className="font-mono">{MOCK_ADMIN_PASSWORD}</code>
              </li>
              {content.booths.map((b) => (
                <li key={b.id}>
                  Officer {b.nama}: <Link className="underline" to={`/staff/${b.slug}`}>/staff/{b.slug}</Link> · PIN <code className="font-mono">{MOCK_STAFF_PINS[b.id] ?? '?'}</code>
                </li>
              ))}
              <li>Dummy participants: PIN <code className="font-mono">1234</code></li>
            </ul>
            {msg && <p className="mt-3 rounded bg-emerald-700/70 px-2 py-1.5">{msg}</p>}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
