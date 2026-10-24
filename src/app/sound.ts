// Optional UI sounds (default off), synthesized with WebAudio so no files are needed.
const KEY = 'fs2.sound'
let ctx: AudioContext | null = null

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? '1' : '0')
}

function ac(): AudioContext | null {
  if (!soundEnabled()) return null
  ctx ??= new AudioContext()
  return ctx
}

function noiseBurst(duration: number, freq: number, gain: number) {
  const a = ac()
  if (!a) return
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * duration), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = freq
  const g = a.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(a.destination)
  src.start()
}

export const sfx = {
  shutter: () => noiseBurst(0.09, 6000, 0.5),
  thunk: () => noiseBurst(0.18, 420, 1.2),
  hum: () => {
    const a = ac()
    if (!a) return
    const o = a.createOscillator()
    const g = a.createGain()
    o.frequency.value = 100
    g.gain.setValueAtTime(0.04, a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.6)
    o.connect(g).connect(a.destination)
    o.start()
    o.stop(a.currentTime + 0.6)
  },
}

export function vibrate(ms: number | number[]) {
  try {
    // browsers block vibrate until the user has interacted with the page
    if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive === false) return
    navigator.vibrate?.(ms)
  } catch {
    /* unsupported */
  }
}
