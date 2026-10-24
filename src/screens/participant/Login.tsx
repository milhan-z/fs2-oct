import { motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../data/api'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { ErrorText, Spinner } from '../../components/ui'
import { Icon } from '../../components/decor'
import { EASE_OUT } from '../../motion/presets'

type Step = 'nrp' | 'pin' | 'register'

const YEARS = Array.from({ length: 8 }, (_, i) => String(2026 - i))

const TITLES: Record<Step, [string, string]> = {
  nrp: ['Identity page', 'Sign in to your passport'],
  pin: ['Welcome back', 'Enter your PIN'],
  register: ['New passport', 'Create your passport'],
}

/**
 * P1 — the inside page of the passport (cream security paper). It grows out of the cover's
 * inside page (layoutId "passport-page"), so opening the passport flows straight into sign-in.
 */
export function Login() {
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { reload } = useParticipant()
  const [step, setStep] = useState<Step>('nrp')
  const [nrp, setNrp] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [nama, setNama] = useState('')
  const [dept, setDept] = useState('')
  const [deptOther, setDeptOther] = useState('')
  const [angkatan, setAngkatan] = useState('2025')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const done = async () => {
    await reload()
    const st = await api.getMyState()
    nav(st.participant.photo ? '/map' : '/photo', { replace: true })
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr('')
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const back = () => {
    if (step === 'nrp') return nav('/')
    setStep('nrp')
    setPin('')
    setPin2('')
    setErr('')
  }

  const submitNrp = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4,14}$/.test(nrp.trim())) return setErr('NRP must contain numbers only.')
    run(async () => {
      const { exists } = await api.checkNrp(nrp)
      setStep(exists ? 'pin' : 'register')
    })
  }

  const submitPin = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(pin)) return setErr('PIN must be 4 digits.')
    run(async () => {
      await api.login(nrp, pin)
      await done()
    })
  }

  const submitRegister = (e: FormEvent) => {
    e.preventDefault()
    const departemen = dept === 'Other' ? deptOther.trim() : dept
    if (nama.trim().length < 3) return setErr('Enter your full name.')
    if (!departemen) return setErr('Choose your department.')
    if (!/^\d{4}$/.test(pin)) return setErr('PIN must be 4 digits.')
    if (pin !== pin2) return setErr("PINs don't match. Please re-enter.")
    run(async () => {
      await api.register({ nrp, nama, departemen, angkatan, pin })
      await done()
    })
  }

  const pinProps = { inputMode: 'numeric' as const, pattern: '[0-9]*', maxLength: 4, autoComplete: 'off', type: 'password' }
  const subtitle =
    step === 'nrp'
      ? 'Use your NRP. No passport yet? We’ll create one for you.'
      : step === 'pin'
        ? `NRP ${nrp} already has a passport.`
        : 'This NRP has no passport yet. Fill this in once, then set a PIN.'
  const label = 'text-[13px] font-bold text-navy'

  return (
    <main className="flex min-h-dvh flex-col bg-bg-0 p-2.5">
      <motion.section layoutId="passport-page" className="paper-page flex flex-1 flex-col overflow-hidden rounded-[18px]" transition={{ duration: 0.55, ease: EASE_OUT }}>
        <motion.div
          className="flex flex-1 flex-col px-5 pt-3 pb-5"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.35, duration: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Back" onClick={back} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-navy hover:bg-navy/5">
              <Icon.Back className="h-5 w-5" />
            </button>
            <p className="font-mono text-[11px] font-bold tracking-[0.3em] text-navy">PASSPORT · FS²</p>
            <span className="w-9" />
          </div>

          <motion.div key={step} initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }} className="flex flex-1 flex-col">
            <p className="mt-3 font-mono text-[11px] tracking-[0.25em] text-[#9a6b12] uppercase">{TITLES[step][0]}</p>
            <h1 className="mt-1 font-serif text-[24px] leading-tight font-bold text-navy">{TITLES[step][1]}</h1>
            <p className="mt-1.5 text-[14px] text-[#5a5048]">{subtitle}</p>

            {step === 'nrp' && (
              <form onSubmit={submitNrp} className="mt-5 flex flex-1 flex-col gap-1.5" noValidate>
                <label htmlFor="nrp" className={label}>
                  NRP
                </label>
                <input id="nrp" className="field-ink" inputMode="numeric" autoComplete="username" placeholder="e.g. 5025240028" value={nrp} onChange={(e) => setNrp(e.target.value.replace(/\D/g, ''))} autoFocus />
                <ErrorText onPaper>{err}</ErrorText>
                <div className="mt-auto pt-6">
                  <button type="submit" className="btn btn-red w-full" disabled={busy || !nrp}>
                    {busy ? <Spinner /> : 'Continue'}
                  </button>
                </div>
              </form>
            )}

            {step === 'pin' && (
              <form onSubmit={submitPin} className="mt-5 flex flex-1 flex-col gap-1.5" noValidate>
                <label htmlFor="pin" className={label}>
                  4-digit PIN
                </label>
                <input id="pin" className="field-ink tracking-[0.6em]" {...pinProps} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
                <ErrorText onPaper>{err}</ErrorText>
                <p className="text-[13px] text-[#5a5048]">Forgot your PIN? Ask for a reset at the Front Office.</p>
                <div className="mt-auto pt-6">
                  <button type="submit" className="btn btn-red w-full" disabled={busy || pin.length !== 4}>
                    {busy ? <Spinner /> : 'Open passport'}
                  </button>
                </div>
              </form>
            )}

            {step === 'register' && (
              <form onSubmit={submitRegister} className="mt-4 flex flex-1 flex-col gap-1.5" noValidate>
                <label htmlFor="r-nrp" className={label}>
                  NRP
                </label>
                <input id="r-nrp" className="field-ink" inputMode="numeric" value={nrp} onChange={(e) => setNrp(e.target.value.replace(/\D/g, ''))} />
                <label htmlFor="r-nama" className={`${label} mt-2`}>
                  Full name
                </label>
                <input id="r-nama" className="field-ink" autoComplete="name" value={nama} onChange={(e) => setNama(e.target.value)} autoFocus />
                <div className="mt-2 grid grid-cols-[1fr_104px] gap-2.5">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor="r-dept" className={label}>
                      Department
                    </label>
                    <select id="r-dept" className="field-ink" value={dept} onChange={(e) => setDept(e.target.value)}>
                      <option value="">Choose…</option>
                      {content?.departemen.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="r-angk" className={label}>
                      Class of
                    </label>
                    <select id="r-angk" className="field-ink" value={angkatan} onChange={(e) => setAngkatan(e.target.value)}>
                      {YEARS.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                {dept === 'Other' && (
                  <>
                    <label htmlFor="r-dept2" className={`${label} mt-2`}>
                      Department name
                    </label>
                    <input id="r-dept2" className="field-ink" value={deptOther} onChange={(e) => setDeptOther(e.target.value)} />
                  </>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="r-pin" className={label}>
                      4-digit PIN
                    </label>
                    <input id="r-pin" className="field-ink tracking-[0.5em]" {...pinProps} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="r-pin2" className={label}>
                      Repeat PIN
                    </label>
                    <input id="r-pin2" className="field-ink tracking-[0.5em]" {...pinProps} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
                  </div>
                </div>
                <p className="mt-1 text-[13px] text-[#5a5048]">Forget it later? Ask for a reset at the Front Office.</p>
                <ErrorText onPaper>{err}</ErrorText>
                <div className="mt-auto pt-5">
                  <button type="submit" className="btn btn-red w-full" disabled={busy}>
                    {busy ? <Spinner /> : 'Create passport'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>

          {/* machine-readable zone, purely decorative */}
          <p className="mt-4 overflow-hidden font-mono text-[11px] tracking-[0.12em] whitespace-nowrap text-navy/35" aria-hidden="true">
            P&lt;FS2&lt;&lt;STUDENT&lt;BOOTH&lt;&lt;OCTOBER&lt;2026&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
          </p>
        </motion.div>
      </motion.section>
    </main>
  )
}
