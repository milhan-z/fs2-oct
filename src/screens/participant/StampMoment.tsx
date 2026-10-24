import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { BigLights } from '../../components/ChristmasLights'
import { StampImg } from '../../components/decor'
import { Loading } from '../../components/ui'
import { sfx, vibrate } from '../../app/sound'
import { EASE_OUT } from '../../motion/presets'

/** P5 — stamp moment (MOTION #4): paper rises, stamp slams down, ink spreads, paper shakes, next light turns on. */
export function StampMoment() {
  const { boothId } = useParams()
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state, prog } = useParticipant()
  const [paperScope, animatePaper] = useAnimate()
  const [stage, setStage] = useState<'paper' | 'stamped' | 'done'>(reduce ? 'done' : 'paper')

  useEffect(() => {
    if (reduce) return
    const t1 = setTimeout(async () => {
      setStage('stamped')
      sfx.thunk()
      vibrate(80)
      if (paperScope.current) await animatePaper(paperScope.current, { x: [0, -3, 3, -3, 3, 0] }, { duration: 0.28 })
    }, 750)
    const t2 = setTimeout(() => setStage('done'), 1350)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [reduce, animatePaper, paperScope])

  if (!content || !state || !prog) return <Loading />
  const booth = content.booths.find((b) => b.id === boothId)
  if (!booth) return <Loading />
  const total = content.booths.length
  const count = prog.stampCount
  const stamped = stage !== 'paper'

  return (
    <main className="flex min-h-dvh flex-col overflow-hidden px-5 pb-6" style={{ background: 'radial-gradient(80% 40% at 50% 38%, #3a0d10 0%, #150a0c 55%, #0b1020 100%)' }}>
      {/* dimmed backdrop fades away once the stamp lands */}
      <motion.div className="pointer-events-none fixed inset-0 z-0 bg-black" initial={{ opacity: 0.6 }} animate={{ opacity: stamped ? 0 : 0.6 }} transition={{ duration: 0.5 }} />

      <BigLights lit={stamped ? count : Math.max(0, count - 1)} count={total} justLit={stamped && !reduce ? count - 1 : null} celebrate={false} className="relative z-10 mx-auto mt-4 w-[78%] max-w-[300px]" />

      <p className="kicker relative z-10 mt-3 text-center">Visit confirmed</p>
      <motion.h1
        className="neon-outline relative z-10 mt-3 text-center font-serif text-[36px] leading-[1.15] font-bold"
        initial={{ opacity: 0 }}
        animate={{ opacity: stamped ? [0, 1, 0.3, 1, 0.5, 1] : 0 }}
        transition={{ duration: 0.7 }}
      >
        Passport
        <br />
        stamped!
      </motion.h1>

      <motion.div
        ref={paperScope}
        className="relative z-10 mx-auto mt-6 aspect-[56/50] w-full max-w-[300px] rounded-[10px] bg-paper p-4 shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
        initial={reduce ? false : { y: 260, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      >
        <p className="text-[12px] tracking-[0.25em] text-[#7a7068] uppercase">Visa · {booth.nama} booth</p>
        <div className="absolute inset-x-0 top-9 bottom-3 flex items-center justify-center">
          <motion.div
            className="h-[92%] w-auto"
            style={{ aspectRatio: '1 / 1' }}
            initial={reduce ? { opacity: 0 } : { y: -260, scale: 1.6, rotate: -2, opacity: 0, filter: 'blur(3px)' }}
            animate={stamped ? { y: 0, scale: [1.6, 0.94, 1], rotate: -9, opacity: 1, filter: 'blur(0px)' } : {}}
            transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 500, damping: 28 }}
          >
            {/* ink: noise mask fades in over the stamp */}
            <div
              className="h-full w-full"
              style={
                reduce
                  ? undefined
                  : {
                      WebkitMaskImage: 'radial-gradient(circle, #000 55%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.6) 100%)',
                      maskImage: 'radial-gradient(circle, #000 55%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.6) 100%)',
                    }
              }
            >
              <StampImg src={booth.stamp} alt={`${booth.nama} stamp`} large className="h-full w-full" />
            </div>
          </motion.div>
        </div>
      </motion.div>

      <img src="/assets/gsm/clouds.svg" alt="" aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-0 mx-auto w-full max-w-[430px] opacity-25" />
      <AnimatePresence>
        {stage === 'done' && (
          <motion.div className="relative z-10 flex flex-1 flex-col" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="mt-5 text-center text-[14px] text-muted">
              {count} of {total} booths stamped. Write your notes now or later.
            </p>
            <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
              <button type="button" onClick={() => nav(`/visa/${booth.id}`, { replace: true })} className="btn btn-cream px-3 text-[15px]">
                Write now
              </button>
              <button type="button" onClick={() => nav('/map', { replace: true })} className="btn btn-red px-3 text-[15px]">
                {count >= total ? 'Back to map' : 'Next booth'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
