import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router'
import { useContent } from '../../app/providers'
import { useParticipant } from '../../app/participant'
import { BUILDING, MapView, type BoothStatus, type MapMode } from '../../map/MapView'
import { BoothSheet } from './BoothSheet'
import { FadeImg, Tape } from '../../booklet/print'
import { setOrigin } from '../../booklet/pages'
import type { Content, MyState } from '../../data/types'
import { boothRoom, roomCounts, type Progress } from '../../data/rules'

const MODE_KEY = 'fs2.mapMode'
const UNFOLDED_KEY = 'fs2.mapUnfolded'
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * P3 — the inside back cover. The floor plan is a folded sheet kept in the back pocket (E3): it
 * slides out and unfolds (3-panel accordion, transform only). The full unfold plays once per
 * session; later visits unfold quickly so a frequent action stays fast.
 */
export function MapScreen() {
  const { content } = useContent()
  const { state, prog } = useParticipant()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  // the whole building comes first; the room tabs (Lounge, Partnership, …) zoom in on one room
  const [mode, setMode] = useState<MapMode>(() => sessionStorage.getItem(MODE_KEY) || BUILDING)
  const openBooth = params.get('booth')
  const [origin, setOriginRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    sessionStorage.setItem(MODE_KEY, mode)
  }, [mode])

  // opening a booth (e.g. from "Next up") first shows the room it stands in
  useEffect(() => {
    const b = content?.booths.find((x) => x.id === openBooth)
    if (b && content) setMode(boothRoom(b, content))
  }, [openBooth, content])

  const status = useMemo(() => {
    const s: Record<string, BoothStatus> = {}
    if (prog) for (const b of content?.booths ?? []) s[b.id] = prog.resumeComplete.has(b.id) ? 'done' : prog.stamped.has(b.id) ? 'stamped' : 'none'
    return s
  }, [prog, content])

  if (!content || !state || !prog) return <MapSkeleton />
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const rooms = roomCounts(content)
  const tabs: { key: MapMode; label: string; n?: number }[] = [{ key: BUILDING, label: 'Whole building' }, ...rooms.map((r) => ({ key: r.label, label: r.label, n: r.n }))]
  const shownMode = tabs.some((x) => x.key === mode) ? mode : BUILDING
  const next = nextStep(content, state, prog)
  const map = (interactive: boolean) => (
    <MapView
      mode={shownMode}
      booths={booths}
      facilities={content.facilities}
      rooms={content.rooms}
      status={status}
      onPin={
        interactive
          ? (id, el) => {
              setOriginRect(el.getBoundingClientRect())
              setParams({ booth: id })
            }
          : undefined
      }
      onRoom={(label) => setMode(label)}
      className="absolute inset-0 h-full w-full"
    />
  )

  return (
    <div className="fade-in mat-cover relative flex min-h-full flex-col pb-3 text-cream">
      {/* paper label stuck inside the back cover */}
      <div className="mat-paper relative mx-3 mt-11 flex items-center gap-3 px-3 py-2.5 shadow-[var(--shadow-contact)]">
        <div className="aspect-[3/4] w-10 flex-none overflow-hidden bg-[#2a2f37] shadow-[var(--shadow-contact)]">
          {state.participant.photo && <FadeImg src={state.participant.photo} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-ink/70">Hi, {state.participant.nama}</p>
          <h1 className="font-serif text-[22px] leading-tight font-bold whitespace-nowrap text-ink">Booth Map</h1>
        </div>
        <p className="flex-none text-right font-mono text-[11px] leading-tight text-ink/70">
          {booths.length > prog.required ? `${prog.stampCount} stamped · ${prog.required} needed` : `${prog.stampCount} of ${booths.length} stamped`}
        </p>
      </div>

      <button type="button" data-tour="next" onClick={(e) => (setOrigin(e.currentTarget), nav(next.to))} className="mx-3 mt-4 flex items-center gap-2 text-left">
        <Tape className="flex-none text-[12px]">Next up</Tape>
        <span className="bg-yellow px-2.5 py-1 text-[14px] leading-tight font-semibold text-navy shadow-[var(--shadow-contact)]">{next.label}</span>
      </button>

      <div role="tablist" aria-label="Map view" className="mx-4 mt-4 flex gap-5">
        {tabs.map((m) => (
          <button key={m.key} role="tab" aria-selected={shownMode === m.key} onClick={() => setMode(m.key)} className={`relative min-h-11 text-[15px] whitespace-nowrap ${shownMode === m.key ? 'font-semibold text-cream' : 'text-cream/60'}`}>
            {m.label}
            {m.n != null && <span className="ml-1 font-mono text-[12px] text-yellow">{m.n}</span>}
            {shownMode === m.key && <motion.span layoutId="map-tab-ink" className="absolute inset-x-0 bottom-1.5 h-[2px] bg-yellow" transition={{ duration: 0.2, ease: EASE }} />}
          </button>
        ))}
      </div>

      <FoldedMap renderMap={map} />

      {/* the legend sits under the map, never on top of it */}
      <ul className="mx-4 mt-7 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold text-cream/90" aria-label="Pin legend">
        {shownMode !== BUILDING ? (
          <>
            <li>○ Not yet</li>
            <li className="text-[#ff8a80]">● Stamped</li>
            <li className="text-ok-bright">● Notes done</li>
          </>
        ) : (
          <li>Tap a room, or use the tabs, to zoom in</li>
        )}
      </ul>

      {/* portal: the sticker overlays the whole scene, not just the page */}
      {createPortal(
        <AnimatePresence>
          {openBooth && content.booths.some((b) => b.id === openBooth) && <BoothSheet key={openBooth} boothId={openBooth} origin={origin} onClose={() => setParams({}, { replace: true })} />}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

/** The folded floor plan: slides out of the back pocket, then unfolds top and bottom panels. */
function FoldedMap({ renderMap, children }: { renderMap: (interactive: boolean) => React.ReactNode; children?: React.ReactNode }) {
  const reduce = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(0)
  const first = useRef(sessionStorage.getItem(UNFOLDED_KEY) !== '1')
  const [done, setDone] = useState(!!reduce)

  useLayoutEffect(() => {
    if (box.current) setH(box.current.clientHeight)
  }, [])
  useEffect(() => {
    if (reduce) return
    const total = first.current ? 1250 : 380
    const t = setTimeout(() => {
      setDone(true)
      sessionStorage.setItem(UNFOLDED_KEY, '1')
    }, total)
    return () => clearTimeout(t)
  }, [reduce])

  const full = first.current
  const slide = full ? 0.38 : 0
  const panelDur = full ? 0.42 : 0.26
  const third = h / 3

  return (
    <div className="relative mx-3 mt-2 min-h-[380px] flex-1" style={{ perspective: 1100 }}>
      <div ref={box} className="absolute inset-0">
        {done || !h ? (
          <div className="absolute inset-0 overflow-hidden rounded-[3px] bg-night-ink shadow-[var(--shadow-lift)]" style={{ backgroundImage: 'var(--tex-noise)' }}>
            {renderMap(true)}
            {children}
          </div>
        ) : (
          <motion.div className="absolute inset-0" initial={{ y: full ? '58%' : 0 }} animate={{ y: 0 }} transition={{ duration: slide, ease: EASE }} style={{ transformStyle: 'preserve-3d' }} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-x-0 overflow-hidden bg-night-ink"
                style={{ top: i * third, height: third, transformOrigin: i === 0 ? '50% 100%' : '50% 0%', backfaceVisibility: 'hidden', backgroundImage: 'var(--tex-noise)' }}
                initial={i === 1 ? false : { rotateX: i === 0 ? 178 : -178 }}
                animate={{ rotateX: 0 }}
                transition={{ duration: panelDur, ease: EASE, delay: slide + (i === 2 ? panelDur * 0.55 : 0) }}
              >
                <div className="absolute inset-x-0" style={{ top: -i * third, height: h }}>
                  {renderMap(false)}
                </div>
                {/* crease shading fades as the panel flattens */}
                <motion.div
                  className="absolute inset-0"
                  style={{ background: i === 0 ? 'linear-gradient(0deg, rgba(0,0,0,.45), transparent 40%)' : i === 2 ? 'linear-gradient(180deg, rgba(0,0,0,.45), transparent 40%)' : 'linear-gradient(180deg, rgba(0,0,0,.25), transparent 15%, transparent 85%, rgba(0,0,0,.25))' }}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: slide + panelDur * 1.4 }}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
      {/* the back pocket lip, stitched */}
      <div className="pointer-events-none absolute inset-x-[-12px] -bottom-3 h-7 bg-[#0e2539] shadow-[0_-3px_6px_rgba(0,0,0,0.35)]" aria-hidden="true">
        <div className="absolute inset-x-3 top-1.5 border-t border-dashed border-emboss/40" />
      </div>
    </div>
  )
}

function nextStep(content: Content, state: MyState, prog: Progress): { label: string; to: string } {
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const unstamped = booths.filter((b) => !prog.stamped.has(b.id))
  if (state.submission?.status === 'revision') return { label: 'Revise your submission (see note)', to: '/status' }
  if (state.submission) return { label: 'Submitted · check status', to: '/status' }
  // any `required` booths count; further visits are optional
  if (prog.stampCount < prog.required && unstamped.length) {
    const names = unstamped.map((b) => b.nama)
    const label = names.length <= 2 ? names.join(' & ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
    return { label: `Visit ${label}`, to: `/map?booth=${unstamped[0].id}` }
  }
  const noResume = prog.resumeCount < prog.required ? booths.find((b) => prog.stamped.has(b.id) && !prog.resumeComplete.has(b.id)) : undefined
  if (noResume) return { label: `Write notes for ${noResume.nama}`, to: `/visa/${noResume.id}` }
  return { label: 'Give feedback & submit', to: '/exit' }
}

/** The map page's own placeholder: same blocks in the same places, so the real page fades in without a jump. */
function MapSkeleton() {
  return (
    <div className="mat-cover relative flex min-h-full flex-col pb-3" aria-busy="true" aria-label="Loading the booth map">
      <div className="mat-paper relative mx-3 mt-11 flex items-center gap-3 px-3 py-2.5 shadow-[var(--shadow-contact)]">
        <div className="aspect-[3/4] w-10 flex-none bg-ink/15 motion-safe:animate-pulse" />
        <div className="flex-1">
          <div className="h-3.5 w-32 bg-ink/10 motion-safe:animate-pulse" />
          <div className="mt-2 h-6 w-40 bg-ink/15 motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="mx-3 mt-4 flex items-center gap-2">
        <div className="h-7 w-16 bg-tape/70 motion-safe:animate-pulse" />
        <div className="h-7 w-52 bg-yellow/40 motion-safe:animate-pulse" />
      </div>
      <div className="mx-4 mt-4 flex h-11 items-center gap-6">
        <div className="h-5 w-16 bg-cream/20 motion-safe:animate-pulse" />
        <div className="h-5 w-28 bg-cream/10 motion-safe:animate-pulse" />
      </div>
      <div className="relative mx-3 mt-2 min-h-[380px] flex-1 rounded-[3px] bg-night-ink motion-safe:animate-pulse" style={{ backgroundImage: 'var(--tex-noise)' }} />
    </div>
  )
}
