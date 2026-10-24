import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { api } from '../../data/api'
import { GrandfatherClock, LogoStrip } from '../../components/decor'
import { BackHeader, Loading } from '../../components/ui'
import { fmtDeadline, fmtTime } from '../../data/time'
import { setSoundEnabled, soundEnabled, sfx } from '../../app/sound'

/** Guide — Stamp4It rules, rundown, help contacts, replay onboarding, sound toggle. */
export function Guide() {
  const nav = useNavigate()
  const { content } = useContent()
  const [sound, setSound] = useState(soundEnabled())
  if (!content) return <Loading />
  const { rules, settings, event } = content
  const loggedIn = api.hasSession()

  const toggleSound = () => {
    setSoundEnabled(!sound)
    setSound(!sound)
    if (!sound) setTimeout(sfx.thunk, 50)
  }

  const steps = [
    'Open your passport with your NRP + a 4-digit PIN (new passports are created on the spot).',
    'Take one attendance photo — your QR activates after that.',
    `Visit all ${rules.jumlah_booth_wajib} booths in the Lounge, in any order. Show your QR, the officer confirms, and your passport gets stamped.`,
    `Write notes for each booth: ${rules.poin_per_resume} points, at least ${rules.min_kata_per_poin} words each. You can do it later.`,
    'Fill in the feedback, then Submit from the Exit page.',
    'On your way out, show your Passport page (4 stamps) to the committee at the exit.',
  ]

  return (
    <main className="screen-bg relative flex min-h-dvh flex-col overflow-hidden pb-8">
      <BackHeader kicker="Guide" />
      <GrandfatherClock className="pointer-events-none absolute top-14 -right-3 h-[150px] opacity-70" />
      <div className="px-5">
        <h1 className="max-w-[75%] text-[24px] leading-tight font-extrabold text-white">How your passport works</h1>

        <ol className="mt-4 flex flex-col gap-2.5 text-[14px]">
          {steps.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-yellow text-[12px] font-extrabold text-navy">{i + 1}</span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>

        <section className="mt-6 rounded-2xl border border-[#7a5a1c] bg-[#2a1a0c]/80 p-4">
          <h2 className="kicker">Stamp4It rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px]">
            <li>
              {rules.jumlah_booth_wajib} booths stamped × {rules.poin_per_resume} note points per booth
            </li>
            <li>Required feedback answered</li>
            <li>Submit by {fmtDeadline(settings.deadline)} WIB (the day after the event)</li>
            <li>Reviewed by the committee after the event; if a revision is needed you can resubmit</li>
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="font-serif text-[18px] font-bold text-white">Rundown</h2>
          <ul className="mt-2 divide-y divide-[#3a2a2e]">
            {event.rundown.map((r) => (
              <li key={r.jam} className="flex gap-4 py-2 text-[14px]">
                <span className="w-12 flex-none font-mono font-bold text-yellow">{r.jam}</span>
                <span>{r.acara}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[12px] text-muted">
            Booth scanning is open {fmtTime(settings.sessionStart)}–{fmtTime(settings.sessionEnd)} WIB.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="font-serif text-[18px] font-bold text-white">Need help?</h2>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {event.kontak_bantuan.map((k) => (
              <a key={k.nama} href={k.wa} target="_blank" rel="noreferrer" className="btn btn-ghost text-[14px]">
                WhatsApp {k.nama}
              </a>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">Forgot your PIN? Ask for a reset at the Front Office.</p>
        </section>

        <div className="mt-6 flex flex-col gap-2.5">
          {loggedIn && (
            <button type="button" className="btn btn-yellow w-full" onClick={() => nav('/onboarding')}>
              Replay the map intro
            </button>
          )}
          <button type="button" role="switch" aria-checked={sound} onClick={toggleSound} className="btn btn-ghost w-full justify-between">
            <span>Sound effects</span>
            <span className={`rounded-full px-3 py-1 text-[12px] ${sound ? 'bg-ok text-white' : 'bg-white/10 text-muted'}`}>{sound ? 'On' : 'Off'}</span>
          </button>
          {loggedIn && (
            <button
              type="button"
              className="min-h-11 text-[13px] text-muted underline underline-offset-4"
              onClick={() => {
                api.logout()
                nav('/', { replace: true })
              }}
            >
              Sign out of the passport on this phone
            </button>
          )}
        </div>

        <LogoStrip className="mx-auto mt-8 w-full max-w-[300px]" />
      </div>
    </main>
  )
}
