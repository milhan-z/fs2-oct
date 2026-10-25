import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { InkIcon } from '../booklet/icons'

const KEY = 'fs2.camprimer'

/**
 * True when the explanation screen should come before the browser's own camera prompt: the permission is still
 * undecided and this device has not seen the explanation yet. Already allowed or already blocked needs no primer
 * (the camera screen shows its own help in the blocked case).
 */
export async function cameraNeedsPrimer(): Promise<boolean> {
  try {
    if (localStorage.getItem(KEY) === '1') return false
  } catch {
    /* storage blocked: show it every time */
  }
  try {
    const st = await navigator.permissions.query({ name: 'camera' as PermissionName })
    if (st.state !== 'prompt') return false
  } catch {
    /* Safari cannot query the camera permission: the primer is the safe default */
  }
  return true
}

export function markCameraPrimerSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
}

/** A plain-language reason and the way out, from the error getUserMedia / the QR scanner threw. */
export function describeCameraError(e: unknown): string {
  const name = (e as { name?: string } | undefined)?.name ?? String(e ?? '')
  if (/NotAllowed|Permission|denied/i.test(name)) return 'Camera access is blocked. Tap the lock icon next to the address (or Settings → your browser → Camera), allow it for this site, then try again.'
  if (/NotFound|Overconstrained|No camera/i.test(name)) return 'No camera was found on this device.'
  if (/NotReadable|TrackStart|Abort/i.test(name)) return 'The camera is busy in another app. Close that app, then try again.'
  return 'The camera could not start. Check that it is allowed for this site, then try again.'
}

/** "Why we need your camera" — shown once, before the browser asks. Continue is what triggers the real prompt. */
export function CameraPrimer({ title, body, onContinue, onCancel }: { title: string; body: string; onContinue: () => void; onCancel?: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => btn.current?.focus(), [])
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-6 fade-in" role="dialog" aria-modal="true" aria-labelledby="cam-primer-title">
      <div className="w-full max-w-[340px] rounded-[22px] bg-[#f3ebdd] px-6 pt-7 pb-5 text-center text-ink shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink/10">
          <InkIcon.Camera className="h-8 w-8" />
        </span>
        <h2 id="cam-primer-title" className="mt-4 font-serif text-[22px] leading-tight font-bold">
          {title}
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-ink/75">{body}</p>
        <button ref={btn} type="button" className="btn btn-primary mt-5 w-full" onClick={onContinue}>
          Continue
        </button>
        {onCancel && (
          <button type="button" className="mt-1 min-h-11 w-full text-[14px] text-ink/65 underline underline-offset-4" onClick={onCancel}>
            Not now
          </button>
        )}
        <p className="mt-2 text-[12px] text-ink/55">Your browser will ask next. Choose “Allow”.</p>
      </div>
    </div>,
    document.body,
  )
}
