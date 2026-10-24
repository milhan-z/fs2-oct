import { motion, useDragControls } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { StringLights } from '../../components/ChristmasLights'
import { Icon, RetroTV, StampImg } from '../../components/decor'
import { loungeSpot, resumeDone } from '../../data/rules'
import { fmtTime } from '../../data/time'
import { springSheet } from '../../motion/presets'

/** P3c — booth bottom sheet with retro-TV speaker card (MOTION #5). */
export function BoothSheet({ boothId, onClose }: { boothId: string; onClose: () => void }) {
  const { content } = useContent()
  const { state, prog } = useParticipant()
  const nav = useNavigate()
  const drag = useDragControls()
  const [slide, setSlide] = useState(0)
  if (!content || !state || !prog) return null

  const booth = content.booths.find((b) => b.id === boothId)!
  const speakers = content.speakers.filter((s) => s.boothId === boothId)
  const visit = state.visits.find((v) => v.boothId === boothId)
  const done = resumeDone(state, boothId, content.rules.min_kata_per_poin)

  return (
    <div className="fixed inset-0 z-40 mx-auto max-w-[430px]" role="dialog" aria-modal="true" aria-labelledby="booth-title">
      <motion.div className="absolute inset-0 bg-black/75" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-[#7a2a2a]"
        style={{ background: 'linear-gradient(180deg, #5a1418 0%, #3a0f11 45%, #250b0d 100%)' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={springSheet}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose()
        }}
      >
        <StringLights className="pointer-events-none absolute top-0 left-0 h-[52px] w-full" />
        <div className="flex cursor-grab touch-none justify-center pt-10 pb-2" onPointerDown={(e) => drag.start(e)} aria-hidden="true">
          <span className="h-[5px] w-11 rounded-full bg-white/30" />
        </div>

        <div className="overflow-y-auto px-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="kicker">{booth.region} booth</p>
              <h2 id="booth-title" className="text-[26px] leading-tight font-extrabold text-white">
                {booth.nama}
              </h2>
              <span className="tape mt-2 text-[14px]">Lounge · {loungeSpot(booth.x, booth.y, content)}</span>
            </div>
            <StampImg src={booth.stamp} alt={`${booth.nama} stamp`} className={`h-[96px] w-[96px] flex-none ${visit ? '' : 'opacity-35 grayscale'}`} />
          </div>

          <div className="no-scrollbar mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
            {speakers.map((s, i) => (
              <div key={s.id} className="w-full flex-none snap-center">
                <div className="grid grid-cols-[42%_1fr] gap-4">
                  <RetroTV src={s.foto} alt={`Photo of ${s.nama}`} powerKey={`${s.id}-${i}`} className="self-start" />
                  <div className="min-w-0">
                    <p className="text-[17px] leading-tight font-extrabold text-white">{s.nama}</p>
                    <p className="mt-2 bg-yellow px-2 py-1 text-[14px] leading-snug font-bold text-navy">{s.universitas}</p>
                    <p className="mt-2 text-[14px] leading-snug text-cream/90">{s.program}</p>
                  </div>
                </div>
                <div className="relative mt-4 rounded-[22px] bg-[#f3e6e0] px-4 py-3 font-serif text-[14px] leading-relaxed text-[#2a1a1c] italic">
                  <span className="absolute -top-2 left-[18%] h-4 w-4 rotate-45 bg-[#f3e6e0]" />
                  “{s.cerita}”
                </div>
              </div>
            ))}
          </div>
          {speakers.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5" aria-label={`Speaker ${slide + 1} of ${speakers.length}`}>
              {speakers.map((s, i) => (
                <span key={s.id} className={`h-2 w-2 rounded-full ${i === slide ? 'bg-yellow' : 'bg-white/30'}`} />
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 text-[14px]">
            {visit ? (
              <>
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-red text-white">
                  <Icon.Check className="h-4 w-4" />
                </span>
                <span>
                  Stamped at {fmtTime(visit.confirmedAt)} · notes {done}/{content.rules.poin_per_resume}
                </span>
              </>
            ) : (
              <>
                <span className="h-8 w-8 flex-none rounded-full border-2 border-dashed border-cream/50" />
                <span className="text-muted">Not stamped yet · show your QR to the booth officer</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1.9fr] gap-3 px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="btn btn-ghost border-[#7a4a4c]">
            Close
          </button>
          {visit ? (
            <button type="button" onClick={() => nav(`/visa/${booth.id}`)} className="btn btn-yellow">
              {done >= content.rules.poin_per_resume ? 'View notes' : 'Write notes'}
            </button>
          ) : (
            <button type="button" onClick={() => nav('/qr')} className="btn btn-red">
              Show QR
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
