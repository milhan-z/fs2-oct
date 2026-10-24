import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'
import { DemogorgonFlower, LogoStrip } from '../../components/decor'
import { useContent } from '../../app/providers'
import { fmtDay } from '../../data/time'

/**
 * The night around the closed passport, built from the GSM kit: partner logos printed at the top,
 * a pine forest with drifting smoke along the bottom, Demogorgon flowers in the dark and a red
 * glow leaking from below. Everything sits behind the book (z-0) and never on paper.
 */
export function CoverScenery() {
  const reduce = useReducedMotion()
  const pines = [
    { h: 150, x: '-6%', o: 0.55 },
    { h: 210, x: '8%', o: 0.75 },
    { h: 170, x: '22%', o: 0.6 },
    { h: 240, x: '38%', o: 0.8 },
    { h: 180, x: '55%', o: 0.65 },
    { h: 225, x: '70%', o: 0.8 },
    { h: 160, x: '86%', o: 0.6 },
  ]
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* partner logos, printed at the top like the GSM header */}
      <div className="absolute inset-x-0 top-2 flex justify-center px-6">
        <LogoStrip className="w-full max-w-[320px]" />
      </div>

      {/* clouds, a red Upside Down glow on the horizon, the town skyline and the forest */}
      <img src="/assets/gsm/clouds.svg" alt="" className="absolute inset-x-0 top-[14%] w-full opacity-[0.07]" />
      <img src="/assets/gsm/clouds.svg" alt="" className="absolute inset-x-0 bottom-[60px] w-full opacity-[0.12]" />
      <div className="absolute inset-x-[-20%] bottom-[40px] h-[220px] bg-[radial-gradient(ellipse_at_50%_100%,rgba(179,38,30,.38),rgba(179,38,30,.1)_45%,transparent_70%)]" />
      <img src="/assets/gsm/skyline.svg" alt="" className="absolute inset-x-0 bottom-[70px] w-full opacity-[0.22] brightness-50" />
      <div className="absolute inset-x-0 bottom-0 h-[260px]">
        {pines.map((p, i) => (
          <img key={i} src="/assets/gsm/pine.webp" alt="" className="absolute bottom-0 w-auto brightness-[0.18] saturate-50" style={{ height: p.h, left: p.x, opacity: p.o }} />
        ))}
        {/* ground fog */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#120a0b] via-[#120a0b]/80 to-transparent" />
      </div>

      {/* drifting smoke */}
      {[
        { src: '/assets/gsm/smoke1.svg', cls: 'left-[-4%] bottom-[90px] w-[34%]', d: 0 },
        { src: '/assets/gsm/smoke2.svg', cls: 'right-[-6%] bottom-[70px] w-[38%]', d: 3 },
      ].map((s) => (
        <motion.img
          key={s.src}
          src={s.src}
          alt=""
          className={`absolute opacity-[0.1] ${s.cls}`}
          animate={reduce ? undefined : { y: [0, -18, 0], opacity: [0.08, 0.14, 0.08] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: s.d }}
        />
      ))}

      {/* spores drifting up */}
      {!reduce &&
        Array.from({ length: 14 }, (_, i) => (
          <motion.span
            key={i}
            className="absolute h-[3px] w-[3px] rounded-full bg-[#f3ebdd]"
            style={{ left: `${(i * 37) % 100}%`, bottom: `${8 + ((i * 23) % 40)}%` }}
            animate={{ y: [0, -60 - (i % 4) * 20], x: [0, i % 2 ? 10 : -10], opacity: [0, 0.55, 0] }}
            transition={{ duration: 7 + (i % 5), repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
          />
        ))}

      {/* Demogorgon flowers growing out of the dark */}
      <DemogorgonFlower size={80} rotate={-18} className="absolute bottom-[214px] -left-7 opacity-90" />
      <DemogorgonFlower size={54} rotate={24} className="absolute right-[-14px] bottom-[236px] opacity-80" />
      <DemogorgonFlower size={38} rotate={8} className="absolute top-[38%] -right-3 opacity-60" />
      <DemogorgonFlower size={30} rotate={-30} className="absolute top-[22%] -left-2 opacity-50" />
      <DemogorgonFlower size={44} rotate={12} className="absolute right-[4%] bottom-[196px] opacity-70" />
      <DemogorgonFlower size={32} rotate={-12} className="absolute bottom-[200px] left-[16%] opacity-55" />
      <DemogorgonFlower size={26} rotate={40} className="absolute top-[52%] left-[6%] opacity-45" />
    </div>
  )
}

/**
 * P0 footer — what lies on the table next to the closed passport: date, venue and the two
 * actions. "Open Passport" opens the cover onto the live sign-in page (MOTION #1). One screen.
 */
export function CoverFooter({ onOpen }: { onOpen: () => void }) {
  const { content } = useContent()
  const nav = useNavigate()
  const tanggal = content ? fmtDay(`${content.event.tanggal}T12:00:00+07:00`) : ''
  const jam = content?.event.jam_acara.replace('–', ' – ') ?? ''

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-[4] bg-gradient-to-t from-[#120a0b] via-[#120a0b]/85 to-transparent px-6 pt-10 pb-[max(14px,env(safe-area-inset-bottom))]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      <p className="text-[16px] font-semibold text-cream [text-shadow:0_1px_3px_rgba(0,0,0,.8)]">{tanggal}</p>
      <p className="mt-0.5 text-[13px] text-cream/85 [text-shadow:0_1px_3px_rgba(0,0,0,.8)]">
        {jam} · {content?.event.tempat}
      </p>
      <motion.button type="button" onClick={onOpen} whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} className="btn btn-primary mt-4 w-full">
        Open Passport
      </motion.button>
      <button type="button" onClick={() => nav('/guide')} className="mt-1 min-h-11 text-[14px] text-cream/85 underline decoration-cream/30 underline-offset-4">
        How it works
      </button>
    </motion.div>
  )
}
