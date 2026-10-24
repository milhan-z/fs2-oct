import { useEffect, useRef, useState } from 'react'
import { RetroTV } from '../../components/decor'

/** Same shape as the TV screen the participants see (RetroTV: aspect 4 / 3.2). */
const RATIO = 4 / 3.2
const OUT_W = 800
const OUT_H = Math.round(OUT_W / RATIO)

const isHeic = (f: File) => /hei[cf]$/i.test(f.name) || /hei[cf]/i.test(f.type)

/** Decodes any photo the browser or heic-to can read. Throws a readable message otherwise. */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    if (!isHeic(file)) throw new Error('This photo could not be opened. Try a JPG or PNG.')
  }
  try {
    const { heicTo } = await import('heic-to')
    return await createImageBitmap(await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 }))
  } catch (e) {
    console.error('HEIC conversion failed', e)
    throw new Error('This HEIC photo could not be converted. Export it as JPG and try again.')
  }
}

/**
 * Lets the admin choose which part of a photo the TV frame shows: drag to move, slider / wheel / arrow keys to zoom,
 * with a live preview inside the same TV the participants see. Returns a 5:4 JPEG.
 */
export function PhotoCropDialog({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const [bmp, setBmp] = useState<ImageBitmap | null>(null)
  const [err, setErr] = useState('')
  const [zoom, setZoom] = useState(1)
  const [c, setC] = useState({ x: 0.5, y: 0.4 }) // crop centre as a fraction of the image (slightly high: faces)
  const [preview, setPreview] = useState<string | null>(null)
  const frame = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)

  useEffect(() => {
    let alive = true
    decode(file)
      .then((b) => alive && setBmp(b))
      .catch((e) => alive && setErr((e as Error).message))
    return () => {
      alive = false
    }
  }, [file])

  // crop rectangle in image pixels for the current zoom / centre (always inside the image)
  const rect = () => {
    const b = bmp!
    const w = Math.min(b.width, b.height * RATIO) / zoom
    const h = w / RATIO
    const x = Math.max(0, Math.min(b.width - w, c.x * b.width - w / 2))
    const y = Math.max(0, Math.min(b.height - h, c.y * b.height - h / 2))
    return { x, y, w, h }
  }

  useEffect(() => {
    if (!bmp || !frame.current) return
    const cv = frame.current
    const r = rect()
    cv.width = 640
    cv.height = Math.round(640 / RATIO)
    cv.getContext('2d')!.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, cv.width, cv.height)
    const small = document.createElement('canvas')
    small.width = 320
    small.height = Math.round(320 / RATIO)
    small.getContext('2d')!.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, small.width, small.height)
    setPreview(small.toDataURL('image/jpeg', 0.8))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bmp, zoom, c])

  const move = (dxFrac: number, dyFrac: number) => setC((p) => ({ x: Math.max(0, Math.min(1, p.x + dxFrac)), y: Math.max(0, Math.min(1, p.y + dyFrac)) }))

  const onDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, cx: c.x, cy: c.y }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !bmp) return
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const r = rect()
    setC({
      x: Math.max(0, Math.min(1, d.cx - ((e.clientX - d.px) / box.width) * (r.w / bmp.width))),
      y: Math.max(0, Math.min(1, d.cy - ((e.clientY - d.py) / box.height) * (r.h / bmp.height))),
    })
  }
  const onKey = (e: React.KeyboardEvent) => {
    const step = 0.02 / zoom
    if (e.key === 'ArrowLeft') move(-step, 0)
    else if (e.key === 'ArrowRight') move(step, 0)
    else if (e.key === 'ArrowUp') move(0, -step)
    else if (e.key === 'ArrowDown') move(0, step)
    else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, z + 0.1))
    else if (e.key === '-') setZoom((z) => Math.max(1, z - 0.1))
    else return
    e.preventDefault()
  }

  const confirm = () => {
    if (!bmp) return
    const r = rect()
    const out = document.createElement('canvas')
    out.width = OUT_W
    out.height = OUT_H
    out.getContext('2d')!.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, OUT_W, OUT_H)
    out.toBlob((b) => (b ? onDone(b) : setErr('Could not prepare the photo.')), 'image/jpeg', 0.86)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="Crop speaker photo">
      <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5">
        <h3 className="text-[18px] font-bold">Choose what the TV shows</h3>
        <p className="mt-1 text-[13px] text-[#6b6058]">Drag the photo to move it, use the slider to zoom. The preview on the right is exactly what participants will see.</p>
        {err ? (
          <p className="mt-4 rounded-lg bg-[#fde2e2] px-3 py-2 text-[14px] text-[#9b2c2c]" role="alert">
            {err}
          </p>
        ) : !bmp ? (
          <p className="mt-6 text-[14px]">Opening photo…</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
            <div>
              <canvas
                ref={frame}
                tabIndex={0}
                aria-label="Photo crop area. Arrow keys move, plus and minus zoom."
                className="block w-full cursor-grab touch-none rounded-lg border border-[#d5cabd] active:cursor-grabbing"
                style={{ aspectRatio: String(RATIO) }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                onWheel={(e) => setZoom((z) => Math.max(1, Math.min(4, z - e.deltaY * 0.002)))}
                onKeyDown={onKey}
              />
              <label className="mt-3 flex items-center gap-3 text-[13px] font-semibold">
                Zoom
                <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="h-8 flex-1" />
              </label>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-bold text-[#4a4038]">Preview</p>
              <RetroTV src={preview} alt="Preview of the cropped photo" />
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="min-h-11 px-4 underline" onClick={onCancel}>
            Cancel
          </button>
          {bmp && !err && (
            <button type="button" className="btn btn-red min-h-11 px-5 text-[15px]" onClick={confirm}>
              Use this crop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
