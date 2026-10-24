import { motion, useReducedMotion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { Icon } from '../../components/decor'
import { Loading } from '../../components/ui'
import { fmtTime, sessionPhase } from '../../data/time'

/** P4 — participant QR (random token, never NRP/PIN). Polls; a confirmation jumps to the stamp moment. */
export function QrScreen() {
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state, prog } = useParticipant()
  if (!content || !state || !prog) return <Loading />

  const s = content.settings
  const phase = sessionPhase(s.sessionStart, s.sessionEnd)
  const all = prog.stampCount >= content.booths.length
  const note = all
    ? 'All booths are stamped. No need to show your QR anymore.'
    : s.simulationMode || phase === 'open'
      ? 'Once the officer taps Confirm, your stamp appears on this screen.'
      : phase === 'before'
        ? `Booth session opens at ${fmtTime(s.sessionStart)} WIB. Your QR is ready.`
        : 'The booth session has ended.'

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-6" style={{ background: 'radial-gradient(70% 38% at 50% 45%, #4a1215 0%, #160a0d 55%, #0b1020 100%)' }}>
      <div className="flex items-center pt-4">
        <button type="button" aria-label="Close QR" onClick={() => nav('/map')} className="flex h-11 w-11 items-center justify-center rounded-full text-cream">
          <Icon.Close className="h-7 w-7" />
        </button>
        <p className="flex-1 pr-11 text-center font-mono text-[14px] font-bold tracking-[0.3em] text-yellow">PASSPORT QR</p>
      </div>

      <h1 className="mt-6 text-center text-[24px] leading-tight font-extrabold text-white">
        Show this to the
        <br />
        booth officer
      </h1>

      <motion.div
        className="mx-auto mt-6 w-full max-w-[310px] rounded-[26px] border-[5px] border-yellow bg-white p-6 shadow-[0_0_40px_rgba(232,32,32,0.35)]"
        initial={reduce ? false : { scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <QRCodeSVG value={`FS2:${state.qrToken}`} size={512} level="M" marginSize={0} fgColor="#0b0d16" className="h-auto w-full" title="Passport QR" />
      </motion.div>

      <p className="mt-5 text-center text-[16px] font-extrabold text-cream">{state.participant.nama}</p>
      <p className="text-center font-mono text-[15px] text-muted">NRP {state.participant.nrpMasked}</p>
      <p className="mt-4 flex items-center justify-center gap-2 text-[14px] text-muted">
        <Icon.Sun className="h-5 w-5 text-yellow" /> Turn up your screen brightness
      </p>

      <div className="mt-auto flex items-center gap-4 rounded-[18px] border border-[#2e3446] bg-[#0b1020]/70 px-5 py-4" role="status">
        <motion.span
          className="h-3 w-3 flex-none rounded-full bg-yellow shadow-[0_0_10px_#F9B018]"
          animate={reduce || all ? undefined : { opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        <p className="text-[14px] text-cream">{note}</p>
      </div>
    </main>
  )
}
