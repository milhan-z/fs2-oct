import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { api } from '../../data/api'
import { useParticipant, useSignOut } from '../../app/participant'
import { startTour } from '../../booklet/CoachTour'
import { LogoStrip } from '../../components/decor'
import { fmtDeadline, fmtTime } from '../../data/time'
import { setSoundEnabled, soundEnabled, sfx } from '../../app/sound'
import { InkIcon } from '../../booklet/icons'
import { Folio, PageSkeleton } from '../../booklet/print'

/** Guide — the passport's printed instruction pages (back matter). */
export function Guide() {
  const nav = useNavigate()
  const { content } = useContent()
  const [sound, setSound] = useState(soundEnabled())
  const [playing, setPlaying] = useState(false)
  const signOut = useSignOut()
  const { state } = useParticipant()
  if (!content) return <PageSkeleton />
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
    <div className="relative flex min-h-full flex-col px-6 pt-3 pb-12">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={() => nav(-1)} className="-ml-3 flex h-11 w-11 items-center justify-center text-ink/80">
          <InkIcon.Back className="h-5 w-5" />
        </button>
        <Folio left="Guide" className="flex-1" />
      </div>

      <LogoStrip className="mx-auto mt-4 w-full max-w-[320px]" />

      <h1 className="page-title mt-6">How your passport works</h1>

      <section className="mt-5" aria-label="Video tutorial">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-[4px] bg-night-0 shadow-[var(--shadow-contact)]">
          {playing ? (
            <video className="h-full w-full" src="/video/fs2-tutorial-vertical.mp4" poster="/video/fs2-tutorial-vertical-poster.jpg" controls autoPlay playsInline preload="auto" aria-label="FS² 30-second tutorial" />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} aria-label="Watch the 30-second tutorial" className="group absolute inset-0 block h-full w-full">
              <img src="/video/fs2-tutorial-vertical-poster.jpg" alt="" className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute inset-0 bg-night-0/35" aria-hidden="true" />
              <span className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-stamp text-white shadow-[0_0_30px_rgba(224,48,42,.7)]" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[14px] font-semibold">Watch the 30-second tutorial</p>
        <p className="text-center text-[12px] text-ink/60">With sound · English</p>
      </section>

      <ol className="mt-8 flex flex-col gap-3 text-[15px] leading-[22px]">
        {steps.map((t, i) => (
          <li key={i} className="grid grid-cols-[28px_1fr] gap-2">
            <span className="pt-px font-mono text-[13px] font-bold text-stamp">{String(i + 1).padStart(2, '0')}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>

      <section className="mt-8 border-[1.5px] border-ink/55 px-4 py-4">
        <h2 className="font-mono text-[12px] font-bold tracking-[0.14em] uppercase">Stamp4It rules</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-[22px]">
          <li>
            {rules.jumlah_booth_wajib} booths stamped × {rules.poin_per_resume} note points per booth
          </li>
          <li>Required feedback answered</li>
          <li>Submit by {fmtDeadline(settings.deadline)} WIB (the day after the event)</li>
          <li>Reviewed by the committee after the event; if a revision is needed you can resubmit</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-[20px] font-bold">Rundown</h2>
        <ul className="mt-2">
          {event.rundown.map((r) => (
            <li key={r.jam} className="grid grid-cols-[56px_1fr] gap-2 border-b border-ink/15 py-2.5 text-[15px]">
              <span className="font-mono font-bold">{r.jam}</span>
              <span>{r.acara}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-ink/60">
          Booth scanning is open {fmtTime(settings.sessionStart)}–{fmtTime(settings.sessionEnd)} WIB.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-[20px] font-bold">Need help?</h2>
        <div className="mt-2 flex flex-wrap gap-x-6">
          {event.kontak_bantuan.map((k) => (
            <a key={k.nama} href={k.wa} target="_blank" rel="noreferrer" className="min-h-11 py-2.5 text-[15px] font-semibold text-stamp underline underline-offset-4">
              WhatsApp {k.nama}
            </a>
          ))}
        </div>
        <p className="mt-1 text-[13px] text-ink/60">Forgot your PIN? Ask for a reset at the Front Office.</p>
      </section>

      <div className="mt-8 flex flex-col">
        {loggedIn && (
          <button type="button" className="min-h-12 border-b border-ink/15 text-left text-[15px] font-semibold" onClick={() => nav('/onboarding')}>
            Replay the map intro
          </button>
        )}
        {loggedIn && state && (
          <button
            type="button"
            className="min-h-12 border-b border-ink/15 text-left text-[15px] font-semibold"
            onClick={() => {
              startTour(state.participant.id)
              nav('/map')
            }}
          >
            Replay the button tour
          </button>
        )}
        <button type="button" role="switch" aria-checked={sound} onClick={toggleSound} className="flex min-h-12 items-center justify-between border-b border-ink/15 text-[15px]">
          <span>Sound effects</span>
          <span className={`font-mono text-[13px] ${sound ? 'text-[#2e7d32]' : 'text-ink/55'}`}>{sound ? 'On' : 'Off'}</span>
        </button>
        {loggedIn && (
          <button
            type="button"
            className="min-h-12 text-left text-[14px] text-ink/65 underline underline-offset-4"
            onClick={signOut}
          >
            Sign out of the passport on this phone
          </button>
        )}
      </div>

    </div>
  )
}
