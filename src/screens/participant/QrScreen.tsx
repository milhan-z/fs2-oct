import { motion, useAnimate, usePresence, useReducedMotion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { useLayoutEffect, useRef } from 'react'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { fmtTime, sessionPhase } from '../../data/time'
import { InkIcon } from '../../booklet/icons'
import { TicketPaper } from '../../booklet/print'
import { takeOrigin } from '../../booklet/pages'

/**
 * P4 — the QR as a perforated permit ticket over the night. It grows out of the QR tab (or the
 * "Show QR" button) and shrinks back into it when closed. Polling + stamp detection are unchanged.
 */
export function QrPermit({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state, prog } = useParticipant()
  const [scope, animate] = useAnimate()
  const [isPresent, safeToRemove] = usePresence()
  const from = useRef<{ x: number; y: number; scale: number } | null>(null)

  useLayoutEffect(() => {
    const el = scope.current as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    const o = takeOrigin()
    from.current = o
      ? { x: o.left + o.width / 2 - (r.left + r.width / 2), y: o.top + o.height / 2 - (r.top + r.height / 2), scale: Math.max(0.1, o.width / r.width) }
      : { x: 0, y: window.innerHeight * 0.7, scale: 1 }
    if (reduce) animate(el, { opacity: [0, 1] }, { duration: 0.12 })
    else animate(el, { x: [from.current.x, 0], y: [from.current.y, 0], scale: [from.current.scale, 1], opacity: [0.3, 1] }, { type: 'spring', stiffness: 300, damping: 30 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    if (isPresent) return
    const el = scope.current as HTMLElement | null
    const f = from.current
    if (!el || !f || reduce) {
      safeToRemove?.()
      return
    }
    animate(el, { x: f.x, y: f.y, scale: f.scale, opacity: 0 }, { duration: 0.26, ease: [0.4, 0, 0.6, 1] }).then(() => safeToRemove?.())
  }, [isPresent, animate, scope, reduce, safeToRemove])

  const ready = content && state && prog
  const s = content?.settings
  const phase = s ? sessionPhase(s.sessionStart, s.sessionEnd) : 'open'
  const all = !!(content && prog && prog.stampCount >= content.booths.length)
  const note = all
    ? 'All booths are stamped. No need to show your QR anymore.'
    : content && prog && prog.stampCount >= prog.required && content.booths.length > prog.required
      ? `You already have the ${prog.required} stamps you need. More visits are optional.`
    : s?.simulationMode || phase === 'open'
      ? 'Once the officer taps Confirm, your visa gets stamped right away.'
      : phase === 'before' && s
        ? `Booth session opens at ${fmtTime(s.sessionStart)} WIB. Your QR is ready.`
        : 'The booth session has ended.'

  return (
    <div className="absolute inset-0 z-50">
      <motion.div className="absolute inset-0 bg-night-0/85" initial={{ opacity: 0 }} animate={{ opacity: isPresent ? 1 : 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
      <button type="button" aria-label="Close QR" onClick={onClose} className="absolute top-3 left-3 z-10 flex h-11 w-11 items-center justify-center text-cream">
        <InkIcon.Close className="h-6 w-6" />
      </button>

      <div className="absolute inset-x-5 top-16 bottom-6 flex flex-col justify-center">
        <div ref={scope}>
          <TicketPaper className="px-5 pt-7 pb-5">
            <p className="font-mono text-[11px] tracking-[0.3em] text-ink/60">PASSPORT QR</p>
            <h1 className="mt-2 font-serif text-[24px] leading-[30px] font-bold text-ink">
              Show this permit to
              <br />
              the booth officer
            </h1>

            <div className="mx-auto mt-5 w-full max-w-[260px] rounded-[2px] bg-[#fffdf7] p-4 shadow-[inset_0_0_0_1.5px_#2a1e1a]">
              {ready ? (
                <QRCodeSVG value={`FS2:${state.qrToken}`} size={512} level="M" marginSize={0} fgColor="#1c1412" bgColor="#fffdf7" className="h-auto w-full" title="Passport QR" />
              ) : (
                <div className="aspect-square w-full bg-ink/5" />
              )}
            </div>

            <p className="mt-4 text-[16px] font-semibold text-ink">{state?.participant.nama}</p>
            <p className="font-mono text-[15px] text-ink/75">NRP {state?.participant.nrp ?? state?.participant.nrpMasked}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink/65">
              <InkIcon.Sun className="h-4 w-4" /> Turn up your screen brightness
            </p>

            {/* stub */}
            <div className="relative mt-5 border-t border-dashed border-ink/35 pt-4">
              <span className="absolute -top-[7px] -left-[27px] h-3.5 w-3.5 rounded-full bg-night-0" aria-hidden="true" />
              <span className="absolute -top-[7px] -right-[27px] h-3.5 w-3.5 rounded-full bg-night-0" aria-hidden="true" />
              <p className="flex items-start gap-3 text-[14px] text-ink/80" role="status">
                <motion.span
                  className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[#c98a00]"
                  initial={reduce || all ? false : { scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4 }}
                />
                {note}
              </p>
            </div>
          </TicketPaper>
        </div>
      </div>
    </div>
  )
}
