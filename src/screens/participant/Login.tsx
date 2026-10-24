import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../data/api'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { ErrorText, Spinner } from '../../components/ui'
import { InkIcon } from '../../booklet/icons'
import { DocLabel, Folio, MRZ, PageNo } from '../../booklet/print'

type Step = 'nrp' | 'pin' | 'register'

const YEARS = Array.from({ length: 8 }, (_, i) => String(2026 - i))

const TITLES: Record<Step, [string, string]> = {
  nrp: ['Identity page', 'Sign in to your passport'],
  pin: ['Welcome back', 'Enter your PIN'],
  register: ['New passport', 'Create your passport'],
}

/**
 * P1 — page 01 of the passport: an application form printed on security paper. It is already
 * mounted under the closed cover, so opening the cover reveals this exact page.
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
      ? 'Present your NRP. No passport yet? The bureau will issue one on the spot.'
      : step === 'pin'
        ? `NRP ${nrp} already has a passport.`
        : 'No passport on file for this NRP yet. Fill in this form once, then set a PIN.'
  const submitBtn = (label: string, disabled: boolean) => (
    <motion.button type="submit" whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} className="btn btn-primary w-full" disabled={disabled}>
      {busy ? <Spinner /> : label}
    </motion.button>
  )

  return (
    <div className="relative flex min-h-full flex-col px-6 pt-3 pb-10">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={back} className="-ml-3 flex h-11 w-11 items-center justify-center text-ink/80">
          <InkIcon.Back className="h-5 w-5" />
        </button>
        <Folio left="Passport · FS²" serial={nrp.length >= 4 ? `FS2-${nrp.slice(-4)}` : 'FS2-————'} className="flex-1" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-1 flex-col"
        >
          <p className="mt-6 text-[13px] text-[#8a5a12] italic">{TITLES[step][0]}</p>
          <h1 className="page-title mt-1">{TITLES[step][1]}</h1>
          <p className="mt-2 text-[15px] leading-[22px] text-ink/75">{subtitle}</p>

          {step === 'nrp' && (
            <form onSubmit={submitNrp} className="mt-8 flex flex-1 flex-col" noValidate>
              <DocLabel htmlFor="nrp">NRP</DocLabel>
              <input id="nrp" className="field-row font-mono tracking-[0.12em]" inputMode="numeric" autoComplete="username" placeholder="e.g. 5025240028" value={nrp} onChange={(e) => setNrp(e.target.value.replace(/\D/g, ''))} />
              <div className="mt-2">
                <ErrorText onPaper>{err}</ErrorText>
              </div>
              <div className="mt-auto pt-8">{submitBtn('Continue', busy || !nrp)}</div>
            </form>
          )}

          {step === 'pin' && (
            <form onSubmit={submitPin} className="mt-8 flex flex-1 flex-col" noValidate>
              <DocLabel htmlFor="pin">4-digit PIN</DocLabel>
              <input id="pin" className="field-row w-40 font-mono tracking-[0.6em]" {...pinProps} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
              <div className="mt-2">
                <ErrorText onPaper>{err}</ErrorText>
              </div>
              <p className="mt-3 text-[13px] text-ink/60">Forgot your PIN? Ask for a reset at the Front Office.</p>
              <div className="mt-auto pt-8">{submitBtn('Open passport', busy || pin.length !== 4)}</div>
            </form>
          )}

          {step === 'register' && (
            <form onSubmit={submitRegister} className="mt-6 flex flex-1 flex-col" noValidate>
              <div className="grid gap-5">
                <div>
                  <DocLabel htmlFor="r-nrp">NRP</DocLabel>
                  <input id="r-nrp" className="field-row font-mono tracking-[0.12em]" inputMode="numeric" value={nrp} onChange={(e) => setNrp(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div>
                  <DocLabel htmlFor="r-nama">Full name</DocLabel>
                  <input id="r-nama" className="field-row" autoComplete="name" value={nama} onChange={(e) => setNama(e.target.value)} autoFocus />
                </div>
                <div className="grid grid-cols-[1fr_96px] gap-4">
                  <div className="min-w-0">
                    <DocLabel htmlFor="r-dept">Department</DocLabel>
                    <select id="r-dept" className="field-row" value={dept} onChange={(e) => setDept(e.target.value)}>
                      <option value="">Choose…</option>
                      {content?.departemen.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <DocLabel htmlFor="r-angk">Class of</DocLabel>
                    <select id="r-angk" className="field-row font-mono" value={angkatan} onChange={(e) => setAngkatan(e.target.value)}>
                      {YEARS.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                {dept === 'Other' && (
                  <div>
                    <DocLabel htmlFor="r-dept2">Department name</DocLabel>
                    <input id="r-dept2" className="field-row" value={deptOther} onChange={(e) => setDeptOther(e.target.value)} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <DocLabel htmlFor="r-pin">4-digit PIN</DocLabel>
                    <input id="r-pin" className="field-row font-mono tracking-[0.5em]" {...pinProps} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div>
                    <DocLabel htmlFor="r-pin2">Repeat PIN</DocLabel>
                    <input id="r-pin2" className="field-row font-mono tracking-[0.5em]" {...pinProps} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[13px] text-ink/60">Forget it later? Ask for a reset at the Front Office.</p>
              <div className="mt-2">
                <ErrorText onPaper>{err}</ErrorText>
              </div>
              <div className="mt-auto pt-8">{submitBtn('Create passport', busy)}</div>
              <p className="mt-3 text-[13px] text-ink/60">Already have a passport? Just enter your NRP + PIN.</p>
            </form>
          )}
        </motion.div>
      </AnimatePresence>

      <MRZ name={step === 'register' && nama ? nama : 'STUDENT BOOTH'} last4={nrp.slice(-4).padStart(4, '<')} className="mt-8" />
      <PageNo n={1} />
    </div>
  )
}
