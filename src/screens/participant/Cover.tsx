import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BigLights } from '../../components/ChristmasLights'
import { DemogorgonFlower, LogoStrip, PassportCover } from '../../components/decor'
import { useContent } from '../../app/providers'
import { api } from '../../data/api'
import { fmtDay } from '../../data/time'
import { EASE_OUT } from '../../motion/presets'

/**
 * P0 — cinematic passport cover, always one screen (no scroll).
 * "Open Passport" swings the cover open on its left hinge (MOTION #1) and reveals the inside
 * paper page, which then grows into the sign-in page (shared layoutId "passport-page").
 */
export function Cover() {
  const { content } = useContent()
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const [opening, setOpening] = useState(false)

  const open = () => {
    if (opening) return
    setOpening(true)
    const next = api.hasSession() ? '/map' : '/signin'
    setTimeout(() => nav(next), reduce ? 0 : 700)
  }

  const tanggal = content ? fmtDay(`${content.event.tanggal}T12:00:00+07:00`) : ''
  const jam = content?.event.jam_acara.replace('–', ' – ') ?? ''

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden px-6 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]" style={{ background: 'radial-gradient(70% 40% at 50% 30%, #2a0e12 0%, #12080a 60%, #0b0d16 100%)' }}>
      <BigLights lit={4} sequence className="mx-auto w-full max-w-[300px] flex-none" />
      <DemogorgonFlower size={56} rotate={14} className="pointer-events-none absolute top-[48%] -left-4 opacity-80" />

      {/* the book: sized by the space left over, never causes scrolling */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-2 [container-type:size]">
        <div className="relative aspect-[3/4] w-[min(290px,100cqw,75cqh)]" style={{ perspective: 1200 }}>
          {/* inside page, revealed when the cover opens */}
          <motion.div layoutId="passport-page" className="paper-page absolute inset-0 overflow-hidden rounded-[3%_6%_6%_3%]" transition={{ duration: 0.55, ease: EASE_OUT }}>
            <div className="flex h-full flex-col p-[9%] text-navy">
              <p className="font-mono text-[11px] font-bold tracking-[0.35em]">PASSPORT · FS²</p>
              <p className="mt-2 font-serif text-[15px] font-bold">Identity page</p>
              <div className="mt-auto space-y-2 opacity-40" aria-hidden="true">
                <div className="h-2 w-3/4 rounded bg-navy/30" />
                <div className="h-2 w-1/2 rounded bg-navy/30" />
              </div>
            </div>
          </motion.div>
          <motion.div
            className="absolute inset-0"
            style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
            initial={{ opacity: 0, y: 16 }}
            animate={opening ? { rotateY: -165, opacity: [1, 1, 0] } : { opacity: 1, y: 0, rotateY: 0 }}
            transition={opening ? { duration: 0.65, ease: [0.55, 0, 0.6, 1], times: [0, 0.8, 1] } : { duration: 0.7, ease: EASE_OUT, delay: 0.2 }}
          >
            <PassportCover tagline={content?.event.tagline ?? 'Stranger Stories from the Other Side!'} />
          </motion.div>
        </div>
      </div>

      <motion.div className="flex-none text-center" animate={{ opacity: opening ? 0 : 1 }} transition={{ duration: 0.2 }}>
        <p className="text-[15px] font-bold text-cream">{tanggal}</p>
        <p className="mt-0.5 text-[13px] text-muted">
          {jam} · {content?.event.tempat}
        </p>
      </motion.div>

      <motion.div className="mt-4 flex flex-none flex-col gap-2.5" animate={{ opacity: opening ? 0 : 1 }} transition={{ duration: 0.2 }}>
        <button type="button" onClick={open} className="btn btn-red-glow w-full">
          Open Passport
        </button>
        <button type="button" onClick={() => nav('/guide')} className="btn btn-ghost w-full">
          How it works
        </button>
        <LogoStrip className="mx-auto mt-1 w-full max-w-[280px] py-1" />
      </motion.div>
    </main>
  )
}
