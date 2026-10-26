import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { api } from '../data/api'
import { useContent } from '../app/providers'
import { useParticipant } from '../app/participant'
import { LightString } from '../components/ChristmasLights'
import { GrandfatherClock, PassportCover } from '../components/decor'
import { isBookPage, pageFor, pageIndex, pathOf, PUBLIC_KEYS, setOrigin, type PageKey } from './pages'
import { InkIcon } from './icons'
import { Login } from '../screens/participant/Login'
import { CoverFooter, CoverScenery } from '../screens/participant/Cover'
import { PageSkeleton } from './print'
import { GrowSheet } from './GrowSheet'
import { CoachTour } from './CoachTour'

// The cover and sign-in page ship in the first bundle; every other page loads on demand and shows
// a printed page skeleton meanwhile (no spinner).
const loadPhoto = () => import('../screens/participant/Photo')
const loadMap = () => import('../screens/participant/MapScreen')
const loadPassport = () => import('../screens/participant/Passport')
const loadVisa = () => import('../screens/participant/Visa')
const loadExit = () => import('../screens/participant/Exit')
const loadStatus = () => import('../screens/participant/Status')
const loadGuide = () => import('../screens/participant/Guide')
const loadQr = () => import('../screens/participant/QrScreen')
const Photo = lazy(() => loadPhoto().then((m) => ({ default: m.Photo })))
const MapScreen = lazy(() => loadMap().then((m) => ({ default: m.MapScreen })))
const Passport = lazy(() => loadPassport().then((m) => ({ default: m.Passport })))
const Visa = lazy(() => loadVisa().then((m) => ({ default: m.Visa })))
const Exit = lazy(() => loadExit().then((m) => ({ default: m.Exit })))
const Status = lazy(() => loadStatus().then((m) => ({ default: m.Status })))
const Guide = lazy(() => loadGuide().then((m) => ({ default: m.Guide })))
const QrPermit = lazy(() => loadQr().then((m) => ({ default: m.QrPermit })))

/** Every page the passport can turn to, fetched one after another while the browser is idle. */
const PREFETCH = [loadPhoto, loadMap, loadPassport, loadQr, loadVisa, loadStatus, loadExit, loadGuide, () => import('../screens/participant/Onboarding')]

const EASE_PAGE = [0.65, 0, 0.35, 1] as const
const LIGHTS_H = 42
const TABS_H = 60

interface Turn {
  id: number
  dir: 1 | -1
  clone: HTMLElement
  scrollTop: number
  gesture?: { velocity: number }
}

/**
 * The passport. Book mode (cover → sign-in → photo) shows the physical passport on the night
 * table; once it is issued, the pages fill the whole screen (Map · Passport · Status · Guide) with
 * index tabs at the bottom. Every page change turns a leaf on the LEFT hinge — forward lifts the
 * current leaf away to the left, back brings the previous leaf back from the left over it.
 */
export function Booklet() {
  const loc = useLocation()
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const { content } = useContent()
  const { state, prog } = useParticipant()
  const raw = pageFor(loc.pathname)

  // overlays (QR permit, visa, exit) sit above whatever page was open before
  const lastKey = useRef<PageKey>(raw.overlay?.kind === 'qr' ? 'map' : 'passport')
  const key: PageKey = raw.key ?? lastKey.current
  useEffect(() => {
    if (raw.key) lastKey.current = raw.key
  }, [raw.key])

  const authed = api.hasSession()
  const hasPhoto = !!state?.participant.photo
  const issued = authed && hasPhoto
  const book = isBookPage(key, issued) || raw.cover

  // --- page turning ---------------------------------------------------------------------------
  const [displayKey, setDisplayKey] = useState<PageKey>(key)
  const pageRef = useRef<HTMLDivElement>(null)
  const [turn, setTurn] = useState<Turn | null>(null)
  const pendingGesture = useRef<Turn['gesture']>(undefined)
  const backAngle = useMotionValue(0)

  useLayoutEffect(() => {
    if (key === displayKey) return
    const el = pageRef.current
    const sameStage = isBookPage(displayKey, issued) === isBookPage(key, issued)
    if (el && sameStage) {
      const clone = el.cloneNode(true) as HTMLElement
      // cloneNode does not carry live form values — copy them so the turning leaf looks identical
      const src = el.querySelectorAll('input, select, textarea')
      clone.querySelectorAll('input, select, textarea').forEach((n, i) => {
        const o = src[i] as HTMLInputElement
        if (n instanceof HTMLSelectElement) n.selectedIndex = (o as unknown as HTMLSelectElement).selectedIndex
        else (n as HTMLInputElement).value = o.value
      })
      clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
      clone.querySelectorAll('video').forEach((v) => v.remove())
      setTurn({ id: Date.now(), dir: pageIndex(key) >= pageIndex(displayKey) ? 1 : -1, clone, scrollTop: el.scrollTop, gesture: pendingGesture.current })
    }
    pendingGesture.current = undefined
    setDisplayKey(key)
  }, [key, displayKey, issued])

  useLayoutEffect(() => {
    if (pageRef.current) pageRef.current.scrollTop = 0
  }, [displayKey])

  // back turn: the live page is the leaf coming back from the left (−180° → 0°)
  useEffect(() => {
    if (!turn || turn.dir !== -1) return
    if (reduce) {
      backAngle.set(0)
      return
    }
    backAngle.set(-180)
    const c = turn.gesture
      ? animate(backAngle, 0, { type: 'spring', stiffness: 240, damping: 30, velocity: turn.gesture.velocity })
      : animate(backAngle, 0, { duration: 0.52, ease: EASE_PAGE })
    c.then(() => setTurn((t) => (t?.id === turn.id ? null : t)))
    return () => c.stop()
  }, [turn, reduce, backAngle])

  // --- geometry -------------------------------------------------------------------------------
  const [vh, setVh] = useState(() => window.innerHeight)
  useEffect(() => {
    const on = () => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const bookTop = raw.cover ? 92 : LIGHTS_H
  const bookH = vh - bookTop - 14
  const closedScale = Math.min(0.84, Math.max(0.5, (vh - bookTop - 236) / bookH))

  // warm the page chunks while the cover or the sign-in form is on screen, so turning a page never waits on the network
  useEffect(() => {
    const idle = typeof window.requestIdleCallback === 'function'
    let stop = false
    const run = async () => {
      for (const load of PREFETCH) {
        if (stop) return
        await load().catch(() => {})
      }
    }
    const id = idle ? window.requestIdleCallback(() => void run(), { timeout: 3000 }) : window.setTimeout(() => void run(), 1200)
    return () => {
      stop = true
      if (idle) window.cancelIdleCallback(id)
      else clearTimeout(id)
    }
  }, [])

  // while the cover is closed, the page underneath renders once the browser is idle
  const [underReady, setUnderReady] = useState(!raw.cover)
  useEffect(() => {
    if (underReady) return
    if (!raw.cover) return setUnderReady(true)
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setUnderReady(true), { timeout: 1500 }) : window.setTimeout(() => setUnderReady(true), 600)
    return () => {
      if (!w.requestIdleCallback) clearTimeout(id)
    }
  }, [raw.cover, underReady])

  // --- back swipe from the left edge (velocity carried into the back turn) ---------------------
  const drag = useRef<{ x: number; t: number; dx: number } | null>(null)
  const onEdgeDown = (e: RPointerEvent) => {
    drag.current = { x: e.clientX, t: performance.now(), dx: 0 }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const onEdgeMove = (e: RPointerEvent) => {
    if (!drag.current || !pageRef.current) return
    const dx = Math.max(0, e.clientX - drag.current.x)
    drag.current.dx = dx
    pageRef.current.style.transform = `translateX(${dx * 0.35}px)`
  }
  const onEdgeUp = () => {
    const d = drag.current
    drag.current = null
    const el = pageRef.current
    if (!d || !el) return
    const w = el.clientWidth
    const v = (d.dx / Math.max(1, performance.now() - d.t)) * 1000
    el.style.transform = ''
    if (d.dx > w * 0.25 || v > 600) {
      pendingGesture.current = { velocity: (v / w) * 180 }
      goBack()
    } else if (d.dx > 0) {
      el.animate([{ transform: `translateX(${d.dx * 0.35}px)` }, { transform: 'translateX(0)' }], { duration: 180, easing: 'cubic-bezier(.22,1,.36,1)' })
    }
  }
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) nav(-1)
    else nav(key === 'map' ? '/passport' : '/map')
  }

  // --- progress lights -------------------------------------------------------------------------
  const total = prog?.required ?? (content ? Math.min(content.rules.jumlah_booth_wajib, content.booths.length) : 4)
  const stamped = Math.min(prog?.stampCount ?? 0, total)
  const prevStamped = useRef(stamped)
  const [justLit, setJustLit] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (stamped > prevStamped.current) {
      setJustLit(stamped - 1)
      if (stamped >= total) setTimeout(() => setCelebrate(true), 700)
    }
    prevStamped.current = stamped
  }, [stamped, total])

  // --- guards (after all hooks) ----------------------------------------------------------------
  if (!authed && !PUBLIC_KEYS.includes(key)) return <Navigate to="/signin" replace />
  if (raw.overlay && !issued && state) return <Navigate to={authed ? '/photo' : '/signin'} replace />
  if (authed && state && !hasPhoto && !['photo', 'signin', 'guide'].includes(key)) return <Navigate to="/photo" replace />

  const page = (
    <Suspense fallback={<PageSkeleton photo={displayKey === 'photo' || displayKey === 'passport'} />}>
      {underReady || !raw.cover ? <PageBody pageKey={displayKey} /> : null}
    </Suspense>
  )

  const leaves = (
    <>
      {/* back turn: the previous leaf (live) swings back over a snapshot of the page being left */}
      {turn?.dir === -1 && <StaticSnapshot turn={turn} />}
      <LeafWrap angle={backAngle}>
        <div ref={pageRef} className={`mat-paper absolute inset-0 ${book ? '' : 'rounded-none'} overflow-x-hidden overflow-y-auto overscroll-contain [backface-visibility:hidden]`} data-page={displayKey} style={{ paddingBottom: 'var(--kb, 0px)' }}>
          {page}
        </div>
      </LeafWrap>
      {turn?.dir === 1 && <TurningLeaf key={turn.id} turn={turn} reduce={!!reduce} onDone={() => setTurn((t) => (t?.id === turn.id ? null : t))} />}
      {!raw.cover && key !== 'signin' && (
        <div className="absolute inset-y-0 left-0 z-20 w-[18px] touch-none" onPointerDown={onEdgeDown} onPointerMove={onEdgeMove} onPointerUp={onEdgeUp} onPointerCancel={onEdgeUp} aria-hidden="true" />
      )}
    </>
  )

  return (
    <div className="absolute inset-0 mx-auto max-w-[430px]">
      {/* scenery on the night (book mode only; the app pages are full screen) */}
      {raw.cover && <CoverScenery />}
      {book && key === 'guide' && <GrandfatherClock className="pointer-events-none absolute bottom-0 -left-6 z-0 h-[230px] opacity-60" />}

      {book ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: raw.cover ? 46 : 2, height: LIGHTS_H }}>
            <LightString lit="all" count={total} sequence={raw.cover && !reduce} className="h-full w-full" />
          </div>
          <motion.div
            className="absolute right-3 left-2 z-[5]"
            style={{ height: bookH, transformOrigin: '50% 0%', perspective: 1600 }}
            initial={false}
            animate={{ top: bookTop, scale: raw.cover ? closedScale : 1 }}
            transition={reduce ? { duration: 0.12 } : raw.cover ? { duration: 0.36, ease: [0.22, 1, 0.36, 1] } : { duration: 0.36, ease: [0.22, 1, 0.36, 1], delay: 0.42 }}
          >
            {/* spine + page edges */}
            <div className="mat-cover absolute inset-y-0 left-0 w-[8px] rounded-l-[3px]" />
            <div className="absolute inset-y-[3px] right-[-5px] w-[6px] rounded-r-[2px] bg-[#d9ccb4] shadow-[1.5px_0_0_#cbbda3]" aria-hidden="true" />
            <div className="absolute inset-y-[1.5px] right-[-2.5px] w-[4px] rounded-r-[2px] bg-[#e4d9c5]" aria-hidden="true" />
            <div className="absolute inset-y-0 right-0 left-[8px] shadow-[var(--shadow-lift)]" style={{ perspective: 1400 }}>
              {leaves}
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-[#2a1e1a]/18 to-transparent" aria-hidden="true" />
              <CoverLeaf open={!raw.cover} reduce={!!reduce} tagline={content?.event.tagline ?? 'Stranger Stories from the Other Side!'} />
            </div>
          </motion.div>
          <AnimatePresence>{raw.cover && <CoverFooter key="footer" onOpen={() => nav(issued ? '/map' : '/signin')} />}</AnimatePresence>
        </>
      ) : (
        <>
          {/* app mode: one full-screen page above the index tabs; the progress lights hang across
              the top of the map (the back pocket) */}
          <div className="absolute inset-x-0 top-0 z-[5]" style={{ bottom: TABS_H, perspective: 1400 }}>
            {leaves}
          </div>
          {key === 'map' && !turn && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[6]" style={{ height: LIGHTS_H }}>
              <LightString lit={stamped} count={total} justLit={justLit} celebrate={celebrate} className="h-full w-full" label={`${stamped} of ${total} stamped`} />
            </div>
          )}
          {key === 'map' && !raw.overlay && <CoachTour />}
          <IndexTabs active={raw.overlay?.kind === 'qr' ? 'qr' : key === 'map' ? 'map' : 'passport'} qrOpen={raw.overlay?.kind === 'qr'} />
        </>
      )}

      {/* overlays grow from the element that opened them */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {raw.overlay?.kind === 'qr' && <QrPermit key="qr" onClose={() => nav(pathOf(lastKey.current))} />}
          {raw.overlay?.kind === 'visa' && (
            <GrowSheet key={`visa-${raw.overlay.boothId}`} label="Visa page" onClose={() => nav(pathOf(lastKey.current))}>
              <Visa boothId={raw.overlay.boothId} stampMode={raw.overlay.stamp} onClose={() => nav(pathOf(lastKey.current))} />
            </GrowSheet>
          )}
          {raw.overlay?.kind === 'exit' && (
            <GrowSheet key="exit" label="Exit page" onClose={() => nav(pathOf(lastKey.current))}>
              <Exit onClose={() => nav(pathOf(lastKey.current))} />
            </GrowSheet>
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  )
}

function PageBody({ pageKey }: { pageKey: PageKey }) {
  switch (pageKey) {
    case 'signin':
      return <Login />
    case 'photo':
      return <Photo />
    case 'map':
      return <MapScreen />
    case 'passport':
      return <Passport />
    case 'status':
      return <Status />
    case 'guide':
      return <Guide />
  }
}

/** Live page wrapper: rotates on the left hinge during a back turn; shows the paper back meanwhile. */
function LeafWrap({ angle, children }: { angle: MotionValue<number>; children: ReactNode }) {
  return (
    <motion.div className="absolute inset-0 z-[2]" style={{ rotateY: angle, transformOrigin: 'left center', transformStyle: 'preserve-3d' }}>
      {children}
      <div className="mat-paper pointer-events-none absolute inset-0 [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }} aria-hidden="true" />
    </motion.div>
  )
}

/** Snapshot of the page being left, lying underneath while the previous leaf comes back over it. */
function StaticSnapshot({ turn }: { turn: Turn }) {
  const holder = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const h = holder.current
    if (!h) return
    h.appendChild(turn.clone)
    Object.assign(turn.clone.style, { position: 'absolute', inset: '0', transform: '' })
    turn.clone.scrollTop = turn.scrollTop
    return () => turn.clone.remove()
  }, [turn])
  return <div ref={holder} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true" inert />
}

/** Forward turn: a snapshot of the page being left lifts away to the left on its hinge. */
function TurningLeaf({ turn, reduce, onDone }: { turn: Turn; reduce: boolean; onDone: () => void }) {
  const holder = useRef<HTMLDivElement>(null)
  const angle = useMotionValue(0)
  const fold = useTransform(angle, (a) => Math.sin((Math.abs(a) / 180) * Math.PI) * 0.4)
  const cast = useTransform(angle, (a) => (1 - Math.abs(a) / 180) * 0.25)
  const opacity = useMotionValue(1)

  useLayoutEffect(() => {
    const h = holder.current
    if (!h) return
    h.appendChild(turn.clone)
    Object.assign(turn.clone.style, { position: 'absolute', inset: '0', transform: '' })
    turn.clone.scrollTop = turn.scrollTop
    return () => turn.clone.remove()
  }, [turn])

  useEffect(() => {
    if (reduce) {
      const c = animate(opacity, 0, { duration: 0.12 })
      c.then(onDone)
      return () => c.stop()
    }
    const c = turn.gesture ? animate(angle, -180, { type: 'spring', stiffness: 240, damping: 30, velocity: -Math.abs(turn.gesture.velocity) }) : animate(angle, -180, { duration: 0.52, ease: EASE_PAGE })
    c.then(onDone)
    return () => c.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <motion.div className="pointer-events-none absolute inset-0 z-[19] bg-[#2a1e1a]" style={{ opacity: reduce ? 0 : cast }} aria-hidden="true" />
      <motion.div className="pointer-events-none absolute inset-0 z-20" style={{ rotateY: angle, opacity, transformOrigin: 'left center', transformStyle: 'preserve-3d' }} aria-hidden="true" inert>
        <div className="absolute inset-0 overflow-hidden [backface-visibility:hidden]">
          <div ref={holder} className="absolute inset-0" />
          <motion.div className="absolute inset-0" style={{ opacity: fold, background: 'linear-gradient(90deg, rgba(42,30,26,0) 30%, rgba(42,30,26,.55))' }} />
        </div>
        <div className="mat-paper absolute inset-0 [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }}>
          <motion.div className="absolute inset-0" style={{ opacity: fold, background: 'linear-gradient(90deg, rgba(42,30,26,.45), rgba(42,30,26,0) 70%)' }} />
        </div>
      </motion.div>
    </>
  )
}

/** Front cover on its left hinge. Its inside face (endpaper) shows once it passes 90°. */
function CoverLeaf({ open, reduce, tagline }: { open: boolean; reduce: boolean; tagline: string }) {
  return (
    <motion.div
      className="absolute -inset-y-[2px] -right-[6px] -left-[8px] z-30"
      style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d', pointerEvents: open ? 'none' : 'auto' }}
      initial={false}
      animate={open ? { rotateY: -168, opacity: [1, 1, 0] } : { rotateY: 0, opacity: 1 }}
      transition={reduce ? { duration: 0.12 } : open ? { duration: 0.7, ease: EASE_PAGE, times: [0, 0.85, 1] } : { duration: 0.6, ease: EASE_PAGE }}
      aria-hidden={open}
    >
      <div className="absolute inset-0 [backface-visibility:hidden]">
        <PassportCover tagline={tagline} />
      </div>
      <div className="mat-cover absolute inset-0 rounded-[3px] [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }}>
        <div className="absolute inset-3 rounded-[2px] border border-emboss/25" />
      </div>
    </motion.div>
  )
}

/** E4 — index tabs on a cover-cloth bar: Map · QR · Passport. The active tab is paper, joined to the page. */
function IndexTabs({ active, qrOpen }: { active: 'map' | 'qr' | 'passport'; qrOpen: boolean }) {
  const nav = useNavigate()
  const tab = (id: 'map' | 'qr' | 'passport', label: string, icon: ReactNode, to: string) => {
    const on = active === id
    return (
      <motion.button
        type="button"
        onClick={(e) => {
          if (id === 'qr') {
            if (qrOpen) return nav(-1)
            setOrigin(e.currentTarget)
          }
          nav(to)
        }}
        data-tour={`tab-${id}`}
        aria-current={on ? 'page' : undefined}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.06 }}
        className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-b-[6px] text-[12px] font-semibold transition-colors duration-150 ${on ? 'mat-paper -mt-[2px] text-ink' : 'text-emboss/85'}`}
        style={{ minHeight: 50 }}
      >
        {id === 'qr' && (
          <span className="pointer-events-none absolute inset-x-2 -top-[4px] flex justify-between" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={`h-[6px] w-[6px] rounded-full ${on ? 'bg-cover' : 'bg-transparent'}`} />
            ))}
          </span>
        )}
        {icon}
        {label}
      </motion.button>
    )
  }
  return (
    <nav aria-label="Main navigation" className="mat-cover absolute inset-x-0 bottom-0 z-[6] flex gap-1 px-2 pb-[max(6px,env(safe-area-inset-bottom))] shadow-[0_-2px_8px_rgba(0,0,0,0.35)]" style={{ height: TABS_H }}>
      {tab('map', 'Map', <InkIcon.Map className="h-6 w-6" />, '/map')}
      {tab('qr', 'QR', <InkIcon.Permit className="h-6 w-6" />, '/qr')}
      {tab('passport', 'Passport', <InkIcon.Passport className="h-6 w-6" />, '/passport')}
    </nav>
  )
}

