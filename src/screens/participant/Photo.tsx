import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router'
import { api, isMock } from '../../data/api'
import { useParticipant, useSignOut } from '../../app/participant'
import { ErrorText } from '../../components/ui'
import { sfx, vibrate } from '../../app/sound'
import { InkIcon } from '../../booklet/icons'
import { DocLabel, Folio, MRZ, PageNo, PageSkeleton } from '../../booklet/print'

/** The map intro is shown once per passport (not once per phone), so a new or re-created account sees it again. */
export const onboardedKey = (participantId: string) => `fs2.onboarded.${participantId}`

/** Draws a neutral sample portrait (mock mode only) so demos work without a camera. */
async function samplePhoto(): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = 540
  c.height = 720
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, 0, 720)
  bg.addColorStop(0, '#7d8794')
  bg.addColorStop(1, '#4a525e')
  g.fillStyle = bg
  g.fillRect(0, 0, 540, 720)
  g.fillStyle = '#e9d8c6'
  g.beginPath()
  g.ellipse(270, 300, 120, 150, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#23324a'
  g.beginPath()
  g.ellipse(270, 760, 300, 280, 0, Math.PI, 0)
  g.fill()
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9))
}

type Shot = { url: string; blob: Blob }

/**
 * P2 — the identity page. The photo box starts empty; a polaroid camera pops out of it, takes the
 * picture, and on "Use this photo" the polaroid flies back and is pasted into the box. Then the
 * MRZ types itself out and the photo is saved (MOTION #3, C2).
 */
export function Photo() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const retake = params.has('ulang')
  const reduce = useReducedMotion()
  const { state, reload } = useParticipant()
  const signOut = useSignOut()
  const boxRef = useRef<HTMLButtonElement>(null)
  const [camOpen, setCamOpen] = useState(false)
  const [pasted, setPasted] = useState<Shot | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // the camera pops out on its own once the page has settled
  useEffect(() => {
    const t = setTimeout(() => setCamOpen(true), reduce ? 0 : 650)
    return () => clearTimeout(t)
  }, [reduce])

  const save = async (shot: Shot) => {
    setBusy(true)
    setErr('')
    try {
      const file = new File([shot.blob], 'kehadiran.jpg', { type: shot.blob.type || 'image/jpeg' })
      const { default: imageCompression } = await import('browser-image-compression')
      const small = await imageCompression(file, { maxWidthOrHeight: 720, initialQuality: 0.7, maxSizeMB: 0.25, useWebWorker: false, fileType: 'image/jpeg' })
      await api.uploadPhoto(small)
      await reload()
      // let the MRZ finish typing before turning the page
      await new Promise((r) => setTimeout(r, reduce ? 0 : 700))
      const onboarded = state ? localStorage.getItem(onboardedKey(state.participant.id)) : null
      nav(retake ? '/passport' : onboarded ? '/map' : '/onboarding', { replace: true })
    } catch (e) {
      setErr((e as Error).message || 'Could not save the photo. Please try again.')
      setBusy(false)
    }
  }

  const onPasted = (shot: Shot) => {
    setCamOpen(false)
    setPasted(shot)
    vibrate(15)
    save(shot)
  }

  if (!state) return <PageSkeleton photo />
  const p = state.participant
  const photo = pasted?.url ?? (retake ? undefined : p.photo)

  return (
    <div className="relative flex min-h-full flex-col px-6 pt-4 pb-10">
      <Folio left="Passport · FS²" serial={`FS2-${p.nrpLast4}`} />
      <p className="mt-6 text-[13px] text-[#8a5a12] italic">Step 1 · Before the booths</p>
      <h1 className="page-title mt-1">Attendance photo</h1>
      <p className="mt-2 text-[15px] leading-[22px] text-ink/75">One photo for your identity page — proof that you crossed over to FS². Booth officers check it before they stamp your visa.</p>

      {/* identity block */}
      <div className="mt-8 grid grid-cols-[136px_1fr] gap-5">
        <div>
          <motion.button
            ref={boxRef}
            type="button"
            onClick={() => !busy && setCamOpen(true)}
            disabled={busy}
            aria-label={photo ? 'Retake attendance photo' : 'Open camera'}
            className="relative block aspect-[3/4] w-full overflow-hidden bg-[#2a2f37]"
            style={{ boxShadow: photo ? 'var(--shadow-contact)' : 'inset 0 0 0 1px rgba(42,30,26,.35)' }}
            initial={false}
            animate={pasted && !reduce ? { scale: [1.04, 1], rotate: [-2, 0] } : undefined}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {photo ? (
              <img src={photo} alt="Your attendance photo" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#c9cdd4]">
                <InkIcon.Camera className="h-8 w-8" />
                <span className="text-[12px] font-semibold">Tap to open camera</span>
              </span>
            )}
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40 mix-blend-screen" viewBox="0 0 100 133" preserveAspectRatio="none" aria-hidden="true">
              <path d="M-5 104c18-10 30 8 52-2s32-14 58-2" fill="none" stroke="#c9a45c" strokeWidth=".7" />
              <path d="M-5 110c18-10 30 8 52-2s32-14 58-2" fill="none" stroke="#c9a45c" strokeWidth=".5" />
            </svg>
            {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'right-0 bottom-0 border-r-2 border-b-2'].map((c) => (
              <span key={c} className={`pointer-events-none absolute h-3 w-3 border-[#8a8f99] ${c}`} aria-hidden="true" />
            ))}
          </motion.button>
        </div>

        <dl className="flex min-w-0 flex-col gap-3">
          <div>
            <DocLabel>Full name</DocLabel>
            <dd className="truncate text-[15px] font-semibold">{p.nama}</dd>
          </div>
          <div>
            <DocLabel>NRP</DocLabel>
            <dd className="doc-data">{p.nrpMasked}</dd>
          </div>
          <div>
            <DocLabel>Department</DocLabel>
            <dd className="text-[14px] leading-tight">{p.departemen}</dd>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <DocLabel>Class of</DocLabel>
              <dd className="doc-data">{p.angkatan}</dd>
            </div>
            {/* ghost image */}
            <div className="aspect-[3/4] w-10 border border-dashed border-ink/25" aria-hidden="true">
              {photo && <motion.img src={photo} alt="" className="h-full w-full object-cover grayscale" initial={{ opacity: 0 }} animate={{ opacity: 0.22 }} transition={{ delay: pasted ? 1.2 : 0, duration: 0.4 }} />}
            </div>
          </div>
        </dl>
      </div>

      <MRZ name={p.nama} last4={p.nrpLast4} reveal={!!pasted} className="mt-5" />

      <p className="mt-5 text-[14px] text-ink/70">
        {busy ? 'Pasting your photo into the passport…' : photo ? 'Photo in place. Tap it to retake.' : 'The camera opens as a polaroid — keep your face clearly visible.'}
      </p>
      <p className="mt-1 text-[12px] text-ink/55">The photo is used as proof of attendance for FS² and is only seen by the committee.</p>
      <div className="mt-1">
        <ErrorText onPaper>{err}</ErrorText>
      </div>

      <div className="mt-auto pt-8">
        {busy ? (
          <div className="relative h-12 overflow-hidden rounded-[4px] border border-ink/25" role="progressbar" aria-label="Saving photo">
            <motion.span className="absolute inset-0 origin-left bg-stamp/85" initial={{ scaleX: 0 }} animate={{ scaleX: 0.92 }} transition={{ duration: 2.6, ease: [0.22, 1, 0.36, 1] }} aria-hidden="true" />
            <span className="relative flex h-full items-center justify-center text-[15px] font-semibold text-cream mix-blend-difference">Saving…</span>
          </div>
        ) : err && pasted ? (
          <button type="button" className="btn btn-primary w-full" onClick={() => save(pasted)}>
            Try again
          </button>
        ) : (
          <motion.button type="button" whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} className="btn btn-primary w-full" onClick={() => setCamOpen(true)}>
            {photo ? 'Retake photo' : 'Open camera'}
          </motion.button>
        )}
      </div>
      {!busy && !retake && (
        <button type="button" onClick={signOut} className="mt-3 min-h-11 self-center text-[14px] text-ink/65 underline underline-offset-4">
          Not {p.nama.split(' ')[0]}? Sign out
        </button>
      )}
      <PageNo n={2} />

      {createPortal(<AnimatePresence>{camOpen && <PolaroidCamera key="cam" boxRef={boxRef} name={p.nama} onClose={() => setCamOpen(false)} onUse={onPasted} />}</AnimatePresence>, document.body)}
    </div>
  )
}

/**
 * The polaroid camera pop-up. It grows out of the photo box, shows the live viewfinder in the
 * polaroid window and, once accepted, flies back so its picture lands exactly on the photo box.
 */
function PolaroidCamera({ boxRef, name, onClose, onUse }: { boxRef: React.RefObject<HTMLElement | null>; name: string; onClose: () => void; onUse: (s: Shot) => void }) {
  const reduce = useReducedMotion()
  const [scope, animate] = useAnimate()
  const winRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [camError, setCamError] = useState('')
  const [shot, setShot] = useState<Shot | null>(null)
  const [flash, setFlash] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [live, setLive] = useState(false)

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const start = useCallback(async () => {
    stop()
    setLive(false)
    setCamError('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
        await videoRef.current.play().catch(() => {})
      }
    } catch {
      setCamError('Camera unavailable. Allow camera access, or take a photo with your phone camera.')
    }
  }, [facing])

  useEffect(() => {
    if (!shot) start()
    return stop
  }, [start, shot])

  /** transform that puts the polaroid's picture window exactly over the photo box */
  const toBox = () => {
    const card = scope.current as HTMLElement | null
    const win = winRef.current
    const box = boxRef.current
    if (!card || !win || !box) return null
    const P = card.getBoundingClientRect()
    const I = win.getBoundingClientRect()
    const B = box.getBoundingClientRect()
    const s = B.width / I.width
    const pc = { x: P.left + P.width / 2, y: P.top + P.height / 2 }
    const ic = { x: I.left + I.width / 2, y: I.top + I.height / 2 }
    const bc = { x: B.left + B.width / 2, y: B.top + B.height / 2 }
    return { x: bc.x - pc.x - s * (ic.x - pc.x), y: bc.y - pc.y - s * (ic.y - pc.y), scale: s }
  }

  // pop out of the photo box
  useLayoutEffect(() => {
    const el = scope.current as HTMLElement | null
    if (!el) return
    const t = toBox()
    if (reduce || !t) animate(el, { opacity: [0, 1] }, { duration: 0.15 })
    else animate(el, { x: [t.x, 0], y: [t.y, 0], scale: [t.scale, 1], rotate: [0, -2], opacity: [0.4, 1] }, { type: 'spring', stiffness: 260, damping: 26 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const capture = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    setFlash(true)
    sfx.shutter()
    vibrate(30)
    setTimeout(() => setFlash(false), 90)
    // passport ratio 3:4, centred crop
    const vw = v.videoWidth
    const vh = v.videoHeight
    const h = Math.min(vh, (vw * 4) / 3)
    const w = (h * 3) / 4
    const c = document.createElement('canvas')
    c.width = Math.min(w, 720)
    c.height = (c.width * 4) / 3
    const ctx = c.getContext('2d')!
    if (facing === 'user') {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, (vw - w) / 2, (vh - h) / 2, w, h, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9))
    setShot({ url: URL.createObjectURL(blob), blob })
    stop()
  }

  const acceptFile = (f: File | Blob | undefined) => {
    if (!f) return
    setCamError('')
    setShot({ url: URL.createObjectURL(f), blob: f })
    stop()
  }

  const redo = () => {
    if (shot) URL.revokeObjectURL(shot.url)
    setShot(null)
  }

  // fly back into the photo box, then hand the picture over
  const use = async () => {
    if (!shot || leaving) return
    setLeaving(true)
    const el = scope.current as HTMLElement | null
    const t = toBox()
    if (el && t && !reduce) {
      await animate(el, { x: t.x, y: t.y, scale: t.scale, rotate: 0 }, { duration: 0.5, ease: [0.65, 0, 0.35, 1] })
    }
    onUse(shot)
  }

  const close = async () => {
    if (leaving) return
    setLeaving(true)
    stop()
    const el = scope.current as HTMLElement | null
    const t = toBox()
    if (el && t && !reduce) await animate(el, { x: t.x, y: t.y, scale: t.scale, rotate: 0, opacity: 0 }, { duration: 0.3, ease: [0.4, 0, 0.6, 1] })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6" role="dialog" aria-modal="true" aria-label="Attendance photo camera">
      <motion.div className="absolute inset-0 bg-night-0/85" initial={{ opacity: 0 }} animate={{ opacity: leaving ? 0 : 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={close} />

      {/* the polaroid */}
      <div ref={scope} className="relative w-full max-w-[290px] bg-[#f7f3ea] p-3 pb-0 shadow-[0_18px_40px_rgba(0,0,0,.55)]" style={{ transformOrigin: 'center' }}>
        <div ref={winRef} className="relative aspect-[3/4] w-full overflow-hidden bg-[#1c2026]">
          {!shot && <video ref={videoRef} onLoadedData={() => setLive(true)} playsInline muted className="h-full w-full object-cover" style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} aria-label="Camera preview" />}
          {shot && <img src={shot.url} alt="Your attendance photo" className="h-full w-full object-cover" />}
          {!shot && !camError && (
            <svg viewBox="0 0 100 133" className="pointer-events-none absolute inset-0 h-full w-full opacity-45" aria-hidden="true">
              <ellipse cx="50" cy="54" rx="22" ry="28" fill="none" stroke="#f3ebdd" strokeWidth="1" strokeDasharray="3 3" />
              <path d="M14 128c4-24 18-36 36-36s32 12 36 36" fill="none" stroke="#f3ebdd" strokeWidth="1" strokeDasharray="3 3" />
            </svg>
          )}
          {camError && !shot && <p className="absolute inset-x-3 top-1/2 -translate-y-1/2 text-center text-[13px] leading-snug text-[#f3ebdd]/85">{camError}</p>}
          <AnimatePresence>{flash && <motion.div className="pointer-events-none absolute inset-0 bg-[#fffaf0]" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} />}</AnimatePresence>
        </div>
        <p className={`flex h-14 items-center justify-center font-serif text-[19px] italic text-ink/80 transition-opacity ${leaving ? 'opacity-0' : ''}`}>{shot ? name.split(' ')[0] : facing === 'user' ? 'Smile :)' : 'Back camera'}</p>
      </div>

      {/* controls under the polaroid */}
      <motion.div className="relative mt-6 w-full max-w-[290px]" animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: 0.15 }}>
        {!shot ? (
          camError ? (
            <div className="flex flex-col items-stretch gap-2">
              {/* the real control is the file input; the label is the visible button */}
              <label className="btn btn-primary w-full cursor-pointer">
                Take photo
                <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => acceptFile(e.target.files?.[0])} />
              </label>
              {isMock && (
                <button type="button" className="min-h-11 text-[14px] text-cream/85 underline underline-offset-4" onClick={async () => acceptFile(await samplePhoto())}>
                  Use sample photo
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 items-center">
              <button type="button" onClick={close} className="min-h-12 justify-self-start text-[15px] text-cream/85">
                Later
              </button>
              <motion.button
                type="button"
                aria-label="Take photo"
                onClick={capture}
                disabled={!live}
                whileTap={{ scale: 0.94 }}
                transition={{ duration: 0.06 }}
                className="flex h-[68px] w-[68px] items-center justify-center justify-self-center rounded-full border-[3px] border-cream disabled:opacity-50"
              >
                <span className="h-12 w-12 rounded-full bg-stamp" />
              </motion.button>
              <button type="button" aria-label="Switch camera" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} className="flex h-12 w-12 items-center justify-center justify-self-end text-cream/85">
                <InkIcon.Camera className="h-7 w-7" />
              </button>
              {isMock && (
                <button type="button" className="col-span-3 mt-2 min-h-11 text-[14px] text-cream/80 underline underline-offset-4" onClick={async () => acceptFile(await samplePhoto())}>
                  Use sample photo
                </button>
              )}
            </div>
          )
        ) : (
          <div className="flex items-center gap-4">
            <button type="button" onClick={redo} className="min-h-12 px-1 text-[15px] font-semibold text-cream/90 underline underline-offset-4">
              Retake
            </button>
            <motion.button type="button" onClick={use} whileTap={{ scale: 0.98 }} transition={{ duration: 0.06 }} className="btn btn-primary flex-1">
              Use this photo
            </motion.button>
          </div>
        )}
        {!shot && <p className="mt-3 text-center text-[13px] text-cream/70">Face clearly visible, good light.</p>}
      </motion.div>
    </div>
  )
}
