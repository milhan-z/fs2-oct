import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../../data/api'
import { useParticipant } from '../../app/participant'
import { Icon } from '../../components/decor'
import { ErrorText, Spinner } from '../../components/ui'
import { sfx, vibrate } from '../../app/sound'
import { EASE_OUT } from '../../motion/presets'

const ONBOARDED_KEY = 'fs2.onboarded'

/** P2 — attendance selfie in a polaroid frame (MOTION #3). */
export function Photo() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const retake = params.has('ulang')
  const reduce = useReducedMotion()
  const { state, reload } = useParticipant()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [camError, setCamError] = useState('')
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null)
  const [flash, setFlash] = useState(false)
  const [busy, setBusy] = useState(false)
  const [flying, setFlying] = useState(false)
  const [err, setErr] = useState('')
  const [scope, animate] = useAnimate()

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const start = useCallback(async () => {
    stop()
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

  const capture = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    setFlash(true)
    sfx.shutter()
    vibrate(30)
    setTimeout(() => setFlash(false), 80)
    const side = Math.min(v.videoWidth, v.videoHeight)
    const c = document.createElement('canvas')
    c.width = c.height = Math.min(side, 900)
    const ctx = c.getContext('2d')!
    if (facing === 'user') {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9))
    setShot({ url: URL.createObjectURL(blob), blob })
    stop()
  }

  const onFile = (f: File | undefined) => {
    if (!f) return
    setShot({ url: URL.createObjectURL(f), blob: f })
    stop()
  }

  const use = async () => {
    if (!shot) return
    setBusy(true)
    setErr('')
    try {
      const file = new File([shot.blob], 'kehadiran.jpg', { type: shot.blob.type || 'image/jpeg' })
      const { default: imageCompression } = await import('browser-image-compression')
      const small = await imageCompression(file, { maxWidthOrHeight: 720, initialQuality: 0.7, maxSizeMB: 0.25, useWebWorker: false, fileType: 'image/jpeg' })
      await api.uploadPhoto(small)
      await reload()
      setFlying(true)
      // Polaroid flies & shrinks into the passport header photo slot (top-left).
      const el = scope.current as HTMLElement
      const r = el.getBoundingClientRect()
      const target = { x: 20 + 32, y: 22 + 38, w: 64 }
      if (!reduce) {
        await animate(
          el,
          { x: target.x - (r.left + r.width / 2), y: target.y - (r.top + r.height / 2), scale: target.w / r.width },
          { duration: 0.7, ease: EASE_OUT },
        )
        await new Promise((res) => setTimeout(res, 550))
      }
      const onboarded = localStorage.getItem(ONBOARDED_KEY)
      nav(retake ? '/passport' : onboarded ? '/map' : '/onboarding', { replace: true })
    } catch (e) {
      setErr((e as Error).message || 'Could not save the photo. Please try again.')
      setBusy(false)
    }
  }

  const redo = () => {
    if (shot) URL.revokeObjectURL(shot.url)
    setShot(null)
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-5 pt-6 pb-6" style={{ background: 'radial-gradient(90% 45% at 50% 35%, #2a0d10 0%, #120a0c 55%, #0b1020 100%)' }}>
      <motion.div animate={{ opacity: flying ? 0 : 1 }}>
        <p className="kicker">Step 1 · Before the booths</p>
        <h1 className="mt-1 text-[26px] leading-tight font-extrabold text-white">Attendance photo</h1>
        <p className="mt-2 text-[14px] text-muted">One selfie as proof that you attended FS². Booth officers also see this photo when confirming your visit.</p>
      </motion.div>

      <div className="relative mt-5 flex justify-center">
        {/* outer wrapper flies to the header; inner polaroid keeps its own swing */}
        <div ref={scope} className="w-[78%] max-w-[300px]">
        <motion.div
          className="bg-[#f4efe4] p-[5%] pb-0 shadow-[0_14px_30px_rgba(0,0,0,0.5)]"
          initial={false}
          animate={shot ? { rotate: reduce ? -2 : [-6, -1, -3, -2], y: 0 } : { rotate: 2 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-[#2a2f37] to-[#1b1e24]">
            {!shot && (
              <>
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} aria-label="Camera preview" />
                <span className="absolute top-3 left-3 text-[13px] text-cream/80">{facing === 'user' ? 'Front camera' : 'Back camera'}</span>
                <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 m-auto h-[70%] opacity-50" aria-hidden="true">
                  <ellipse cx="50" cy="40" rx="17" ry="21" fill="none" stroke="#fff" strokeWidth="1.2" strokeDasharray="4 3" />
                  <path d="M20 92c3-18 15-28 30-28s27 10 30 28" fill="none" stroke="#fff" strokeWidth="1.2" strokeDasharray="4 3" />
                </svg>
              </>
            )}
            <AnimatePresence>
              {shot && (
                <motion.img
                  key={shot.url}
                  src={shot.url}
                  alt="Your attendance photo"
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE_OUT }}
                />
              )}
            </AnimatePresence>
          </div>
          <div className="py-3 text-center font-serif text-[15px] text-[#0d2a4a] italic">FS² · 28·10·26</div>
        </motion.div>
        </div>

        {/* storyboard 2c: passport label appears beside the flown photo */}
        <AnimatePresence>
          {flying && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 }} className="fixed top-[24px] left-[100px] z-10">
              <p className="kicker text-[12px]">FS² Passport</p>
              <p className="text-[16px] font-extrabold text-white">{state?.participant.nama}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div animate={{ opacity: flying ? 0 : 1 }} className="mt-4 text-center text-[14px] text-muted">
        {camError ? <span className="text-[#ffb4a8]">{camError}</span> : shot ? 'Is your face clearly visible? Use this photo.' : 'Make sure your face is clearly visible'}
      </motion.div>
      <p className="mt-1 text-center text-[12px] text-muted/80">The photo is used as proof of attendance for FS² and is only seen by the committee.</p>
      <ErrorText>{err}</ErrorText>

      <motion.div animate={{ opacity: flying ? 0 : 1 }} className="mt-auto pt-6">
        {!shot ? (
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              aria-label="Switch camera"
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              className="absolute left-[12%] flex h-14 w-14 items-center justify-center rounded-full border border-[#4a3a3e] text-cream"
            >
              <Icon.Flip className="h-6 w-6" />
            </button>
            {camError ? (
              <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-red">
                Take photo
              </button>
            ) : (
              <button type="button" aria-label="Take photo" onClick={capture} className="h-[78px] w-[78px] rounded-full border-[5px] border-[#f4efe4] bg-red shadow-[0_0_24px_rgba(232,32,32,0.5)] active:scale-95" />
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose photo" />
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_1.4fr] gap-3">
            <button type="button" onClick={redo} className="btn btn-ghost" disabled={busy}>
              Retake
            </button>
            <button type="button" onClick={use} className="btn btn-red" disabled={busy}>
              {busy ? <Spinner /> : 'Use this photo'}
            </button>
          </div>
        )}
      </motion.div>

      {/* shutter flash */}
      <AnimatePresence>{flash && <motion.div className="pointer-events-none fixed inset-0 z-50 bg-white" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} />}</AnimatePresence>
    </main>
  )
}

export { ONBOARDED_KEY }
