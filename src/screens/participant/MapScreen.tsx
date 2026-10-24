import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { ProgressLights, StringLights } from '../../components/ChristmasLights'
import { DemogorgonFlower, FsBadge } from '../../components/decor'
import { Loading } from '../../components/ui'
import { MapView, type BoothStatus, type MapMode } from '../../map/MapView'
import { BoothSheet } from './BoothSheet'
import type { Content, MyState } from '../../data/types'
import type { Progress } from '../../data/rules'

const MODE_KEY = 'fs2.mapMode'

/** P3 — home map with Lounge / whole-building toggle and booth pins. */
export function MapScreen() {
  const { content } = useContent()
  const { state, prog } = useParticipant()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<MapMode>(() => (sessionStorage.getItem(MODE_KEY) as MapMode) || 'lounge')
  const openBooth = params.get('booth')

  useEffect(() => {
    sessionStorage.setItem(MODE_KEY, mode)
  }, [mode])

  const status = useMemo(() => {
    const s: Record<string, BoothStatus> = {}
    if (prog) for (const b of content?.booths ?? []) s[b.id] = prog.resumeComplete.has(b.id) ? 'done' : prog.stamped.has(b.id) ? 'stamped' : 'none'
    return s
  }, [prog, content])

  if (!content || !state || !prog) return <Loading />
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const next = nextStep(content, state, prog)

  return (
    <main className="screen-bg-red relative flex flex-1 flex-col overflow-hidden">
      <Header name={state.participant.nama} pid={state.participant.id} title="Booth Map" lit={prog.stampCount} total={booths.length} />

      <button type="button" onClick={() => nav(next.to)} className="mx-5 mt-3 flex items-center gap-2.5 text-left">
        <span className="tape flex-none text-[12px]">Next up</span>
        <span className="flex min-h-10 flex-1 items-center bg-yellow px-3 py-1.5 text-[14px] leading-tight font-extrabold text-navy">{next.label}</span>
      </button>

      <div role="tablist" aria-label="Map view" className="mx-5 mt-3 grid grid-cols-2 rounded-full border border-line bg-black/35 p-[3px]">
        {(['lounge', 'building'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`relative h-11 rounded-full text-[14px] font-bold transition-colors ${mode === m ? 'text-[#2a0d10]' : 'text-cream'}`}
          >
            {mode === m && <motion.span layoutId="map-toggle" className="absolute inset-0 rounded-full bg-cream" transition={{ duration: 0.3 }} />}
            <span className="relative">{m === 'lounge' ? 'Lounge' : 'Whole building'}</span>
          </button>
        ))}
      </div>

      <div className="panel-red relative mx-4 mt-3 mb-3 min-h-[380px] flex-1 overflow-hidden rounded-[22px] border-2 border-[#7a2a2a]">
        <MapView
          mode={mode}
          booths={booths}
          facilities={content.facilities}
          rooms={content.rooms}
          status={status}
          onPin={(id) => setParams({ booth: id })}
          onLounge={() => setMode('lounge')}
          className="absolute inset-0 h-full w-full"
        />
        <StringLights className="pointer-events-none absolute top-0 left-0 h-[60px] w-full" />
        {mode === 'lounge' ? (
          <div className="absolute bottom-2.5 left-3 flex gap-2.5 rounded-md bg-[#0f0709]/75 px-2 py-1 text-[11px] font-semibold">
            <span>○ Not yet</span>
            <span className="text-[#ff6a5c]">● Stamped</span>
            <span className="text-ok-bright">● Notes done</span>
          </div>
        ) : (
          <p className="absolute bottom-2.5 left-3 rounded-md bg-[#0f0709]/75 px-2 py-1 text-[11px] font-semibold text-cream/90">Tap the Lounge to zoom in</p>
        )}
      </div>
      <DemogorgonFlower size={70} rotate={12} className="pointer-events-none absolute top-[230px] -right-4" />

      <AnimatePresence>
        {openBooth && content.booths.some((b) => b.id === openBooth) && (
          <BoothSheet key={openBooth} boothId={openBooth} onClose={() => setParams({}, { replace: true })} />
        )}
      </AnimatePresence>
    </main>
  )
}

export function Header({ name, pid, title, lit, total }: { name: string; pid: string; title: string; lit: number; total: number }) {
  const reduce = useReducedMotion()
  const key = `fs2.lightsSeen.${pid}`
  const prev = useRef(Number(localStorage.getItem(key) ?? lit))
  const [justLit, setJustLit] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    if (lit > prev.current) {
      setJustLit(lit - 1)
      if (lit >= total) setTimeout(() => setCelebrate(true), 650)
    }
    prev.current = lit
    localStorage.setItem(key, String(lit))
  }, [lit, total, key])

  return (
    <div className="relative flex items-center gap-3 px-5 pt-5">
      <FsBadge size={46} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-muted">Hi, {name}</p>
        <h1 className="text-[18px] leading-tight font-extrabold text-white">{title}</h1>
      </div>
      <div className="flex flex-col items-end gap-1">
        <ProgressLights lit={lit} count={total} justLit={justLit} celebrate={celebrate} />
        <span className="text-[12px] text-muted">
          {lit} of {total} stamped
        </span>
      </div>
      {/* 4/4: tiny Demogorgon-flower confetti */}
      <AnimatePresence>
        {celebrate && !reduce && (
          <motion.div className="pointer-events-none absolute top-6 right-10 z-20" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 1.4, duration: 0.4 }} onAnimationComplete={() => setCelebrate(false)}>
            {Array.from({ length: 8 }, (_, i) => (
              <motion.div
                key={i}
                className="absolute"
                initial={{ x: 0, y: 0, scale: 0.2, rotate: 0 }}
                animate={{ x: Math.cos((i / 8) * Math.PI * 2) * 70, y: Math.sin((i / 8) * Math.PI * 2) * 50 + 40, scale: 0.4, rotate: 180 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              >
                <DemogorgonFlower size={28} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function nextStep(content: Content, state: MyState, prog: Progress): { label: string; to: string } {
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const unstamped = booths.filter((b) => !prog.stamped.has(b.id))
  if (state.submission?.status === 'revision') return { label: 'Revise your submission (see note)', to: '/status' }
  if (state.submission) return { label: 'Submitted · check status', to: '/status' }
  if (unstamped.length) {
    const names = unstamped.map((b) => b.nama)
    const label = names.length <= 2 ? names.join(' & ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
    return { label: `Visit ${label}`, to: `/map?booth=${unstamped[0].id}` }
  }
  const noResume = booths.find((b) => !prog.resumeComplete.has(b.id))
  if (noResume) return { label: `Write notes for ${noResume.nama}`, to: `/visa/${noResume.id}` }
  return { label: 'Give feedback & submit', to: '/exit' }
}
