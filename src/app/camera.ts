/** Camera hygiene: the phone's camera light must go out the moment we stop needing it. */

/** Stops every track of the stream attached to a video element and detaches it. */
export function releaseVideo(v: HTMLVideoElement | null) {
  const s = v?.srcObject
  if (s instanceof MediaStream) s.getTracks().forEach((t) => t.stop())
  if (v) v.srcObject = null
}

/**
 * Calls `onHide` when the page goes to the background (home screen, another app, a locked phone, a closing tab) and
 * `onShow` when it comes back. Returns the unsubscribe function.
 */
export function onBackground(onHide: () => void, onShow: () => void) {
  const vis = () => (document.hidden ? onHide() : onShow())
  document.addEventListener('visibilitychange', vis)
  window.addEventListener('pagehide', onHide)
  return () => {
    document.removeEventListener('visibilitychange', vis)
    window.removeEventListener('pagehide', onHide)
  }
}
