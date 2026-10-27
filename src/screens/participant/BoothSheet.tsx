import { motion, useAnimate, useDragControls, usePresence, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { RetroTV } from '../../components/decor'
import { boothRoom, resumeDone, roomSpot } from '../../data/rules'
import { fmtTime } from '../../data/time'
import { InkIcon } from '../../booklet/icons'
import { InkStamp, Tape } from '../../booklet/print'
import { setOrigin } from '../../booklet/pages'

/**
 * P3c — booth pop-up as a visa sticker. It grows out of the pressed pin and shrinks back into it
 * when closed (MOTION #5). Content is unchanged; the TV still switches on.
 */
export function BoothSheet({ boothId, origin, onClose }: { boothId: string; origin: DOMRect | null; onClose: () => void }) {
  const { content } = useContent()
  const { state, prog } = useParticipant()
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const drag = useDragControls()
  const [scope, animate] = useAnimate()
  const [isPresent, safeToRemove] = usePresence()
  const from = useRef<{ x: number; y: number; scale: number } | null>(null)
  const [slide, setSlide] = useState(0)
  const [ready, setReady] = useState(false)

  // grow from the pin: measure the final sticker, start it at the pin's rect, spring to place
  useLayoutEffect(() => {
    const el = scope.current as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    from.current = origin
      ? { x: origin.left + origin.width / 2 - (r.left + r.width / 2), y: origin.top + origin.height / 2 - (r.top + r.height / 2), scale: Math.max(0.08, origin.width / r.width) }
      : { x: 0, y: window.innerHeight * 0.6, scale: 1 }
    if (reduce) {
      animate(el, { opacity: [0, 1] }, { duration: 0.12 })
    } else {
      animate(el, { x: [from.current.x, 0], y: [from.current.y, 0], scale: [from.current.scale, 1], opacity: [0.4, 1] }, { type: 'spring', stiffness: 320, damping: 30 })
    }
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // shrink back into the pin on close
  useLayoutEffect(() => {
    if (isPresent) return
    const el = scope.current as HTMLElement | null
    const f = from.current
    if (!el || !f || reduce) {
      safeToRemove?.()
      return
    }
    animate(el, { x: f.x, y: f.y, scale: f.scale, opacity: 0 }, { duration: 0.28, ease: [0.4, 0, 0.6, 1] }).then(() => safeToRemove?.())
  }, [isPresent, animate, scope, reduce, safeToRemove])

  if (!content || !state || !prog) return null
  const booth = content.booths.find((b) => b.id === boothId)!
  const speakers = content.speakers.filter((s) => s.boothId === boothId)
  const visit = state.visits.find((v) => v.boothId === boothId)
  const done = resumeDone(state, boothId, content.rules.min_kata_per_poin)

  return (
    <div className="fixed inset-0 z-40 mx-auto max-w-[430px]" role="dialog" aria-modal="true" aria-labelledby="booth-title">
      <motion.div className="absolute inset-0 bg-night-0/75" initial={{ opacity: 0 }} animate={{ opacity: isPresent ? 1 : 0 }} transition={{ duration: 0.22 }} onClick={onClose} />
      <div className="absolute inset-0 overflow-y-auto overscroll-contain px-4 pt-10 pb-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <motion.div
          ref={scope}
          className="mat-paper relative rotate-[-1.2deg] rounded-[2px] px-5 pt-5 pb-5 text-ink shadow-[var(--shadow-lift)]"
          style={{ opacity: ready ? undefined : 0 }}
          drag="y"
          dragControls={drag}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 110 || info.velocity.y > 600) onClose()
          }}
        >
          {/* tear-off grip: drag down to close */}
          <div className="absolute inset-x-0 top-0 flex h-6 cursor-grab touch-none justify-center pt-2" onPointerDown={(e) => drag.start(e)} aria-hidden="true">
            <span className="h-[3px] w-10 rounded-[2px] bg-ink/25" />
          </div>
          <div className="flex items-start gap-3 pt-2">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] tracking-[0.12em] text-ink/60 uppercase">{booth.region} booth</p>
              <h2 id="booth-title" className="mt-1 font-serif text-[30px] leading-[34px] font-bold">
                {booth.nama}
              </h2>
              <Tape className="mt-2">
                {boothRoom(booth, content)} · {roomSpot(booth.x, booth.y, content)}
              </Tape>
            </div>
            <InkStamp src={booth.stamp} seed={booth.id} size={104} alt={`${booth.nama} stamp`} pending={!visit} />
          </div>

          <div className="no-scrollbar mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
            {speakers.map((s, i) => (
              <div key={s.id} className="w-full flex-none snap-center">
                <div className="grid grid-cols-[42%_1fr] gap-4">
                  <RetroTV src={s.foto} alt={`Photo of ${s.nama}`} powerKey={`${s.id}-${i}`} className="self-start" />
                  <div className="min-w-0">
                    <p className="text-[18px] leading-tight font-semibold">{s.nama}</p>
                    <p className="mt-2 bg-yellow px-2 py-1 text-[13px] leading-snug font-semibold text-navy">{s.universitas}</p>
                    <p className="mt-2 text-[14px] leading-snug text-ink/80">{s.program}</p>
                  </div>
                </div>
                <div className="relative mt-4 rounded-[3px] bg-[#fbf3e6] px-4 py-3 font-serif text-[15px] leading-relaxed text-ink italic shadow-[var(--shadow-contact)]">
                  <span className="absolute -top-1.5 left-[18%] h-3 w-3 rotate-45 bg-[#fbf3e6]" aria-hidden="true" />“{s.cerita}”
                </div>
              </div>
            ))}
          </div>
          {speakers.length > 1 && (
            <div className="mt-2 flex gap-1.5" aria-label={`Speaker ${slide + 1} of ${speakers.length}`}>
              {speakers.map((s, i) => (
                <span key={s.id} className={`h-1.5 w-4 rounded-[1px] ${i === slide ? 'bg-ink' : 'bg-ink/20'}`} />
              ))}
            </div>
          )}

          <p className="mt-4 flex items-center gap-2.5 text-[14px]">
            {visit ? (
              <>
                <InkIcon.Check className="h-5 w-5 flex-none text-stamp" />
                <span>
                  Stamped at <span className="font-mono">{fmtTime(visit.confirmedAt)}</span> · notes {done}/{content.rules.poin_per_resume}
                </span>
              </>
            ) : (
              <>
                <span className="h-4 w-4 flex-none rounded-full border-[1.5px] border-dashed border-ink/45" />
                <span className="text-ink/70">Visa not stamped yet · show your QR permit to the booth officer</span>
              </>
            )}
          </p>
        </motion.div>

        {/* actions sit on the night, under the sticker */}
        <motion.div className="mt-5 flex items-center gap-4 px-1" initial={{ opacity: 0 }} animate={{ opacity: isPresent ? 1 : 0 }} transition={{ delay: isPresent ? 0.15 : 0, duration: 0.2 }}>
          <button type="button" onClick={onClose} className="min-h-12 px-1 text-[15px] font-semibold text-cream/85 underline decoration-cream/30 underline-offset-4">
            Close
          </button>
          {visit ? (
            <motion.button type="button" whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} onClick={(e) => (setOrigin(e.currentTarget), nav(`/visa/${booth.id}`))} className="btn btn-primary flex-1">
              {done >= content.rules.poin_per_resume ? 'View notes' : 'Write notes'}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.06 }}
              onClick={(e) => {
                setOrigin(e.currentTarget)
                nav('/qr')
              }}
              className="btn btn-primary flex-1"
            >
              Show QR
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  )
}
