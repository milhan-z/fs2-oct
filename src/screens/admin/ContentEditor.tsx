import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../../data/api'
import { Loading } from '../../components/ui'
import { useContent } from '../../app/providers'
import type { Booth, Facility, Question, Speaker } from '../../data/types'
import { LOUNGE_BOUNDS, PLAN, WALLS_INNER, pinPath, viewBoxOf, type Rect } from '../../map/geometry'
import { StampImg } from '../../components/decor'
import { PhotoCropDialog } from './PhotoCropDialog'

/** Resizes an image in the browser, then uploads it (public content bucket / data URL in mock). */
async function uploadImage(file: File, max = 480): Promise<string> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * s)
  c.height = Math.round(bmp.height * s)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const png = file.type === 'image/png'
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), png ? 'image/png' : 'image/jpeg', 0.82))
  return api.uploadContentImage(blob, png ? 'png' : 'jpg')
}

const card = 'rounded-2xl border border-[#e4ddd0] bg-white p-5'
const lbl = 'text-[13px] font-bold text-[#4a4038]'

/** A4 — booths, speakers, facilities, feedback questions, and map points (drag/click to place). */
export function ContentEditor() {
  const { content, reload } = useContent()
  const [saved, setSaved] = useState('')
  if (!content) return <Loading dark={false} />
  const done = (m = 'Saved') => {
    reload()
    setSaved(m)
    setTimeout(() => setSaved(''), 1800)
  }
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const required = Math.min(content.rules.jumlah_booth_wajib, booths.length)

  // a new booth gets the next free number (B5, slug booth-5), a spot inside the Lounge to drag from, and one placeholder speaker
  const addBooth = async () => {
    const used = new Set(booths.map((b) => b.id))
    const slugs = new Set(booths.map((b) => b.slug))
    let n = Math.max(0, ...booths.map((b) => Number(/^B(d+)$/.exec(b.id)?.[1] ?? 0))) + 1
    while (used.has(`B${n}`) || slugs.has(`booth-${n}`)) n++
    const k = booths.length
    const id = `B${n}`
    try {
      await api.adminUpsertBooth({
        id,
        slug: `booth-${n}`,
        nama: `Booth ${n}`,
        region: '',
        stamp: null,
        x: Math.round(LOUNGE_BOUNDS.x + LOUNGE_BOUNDS.w / 2 + ((k % 3) - 1) * 110),
        y: Math.round(LOUNGE_BOUNDS.y + 320 + Math.floor(k / 3) * 150),
        placeholderPos: true,
        sort: Math.max(0, ...booths.map((b) => b.sort)) + 1,
      })
      await api.adminUpsertSpeaker({ id: `${id}-s1`, boothId: id, nama: 'Speaker TBA', universitas: '', program: '', foto: null, cerita: '', placeholder: true })
      done('Booth added — drag its pin on the map')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <section className="p-5 md:p-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[28px] font-extrabold">Booths & content</h1>
        {saved && <span className="rounded-full bg-[#e3f3e6] px-3 py-1 text-[14px] font-bold text-[#2e7d32]">{saved}</span>}
      </div>
      <p className="mt-1 text-[14px] text-[#6b6058]">Every change shows up on participants’ phones right away (no redeploy).</p>
      <p className="mt-1 text-[14px] text-[#6b6058]">
        There can be any number of booths and speakers. Each participant only has to finish <b>{required}</b> booths (stamp + notes) — whichever they choose.
      </p>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <MapEditor booths={booths} facilities={content.facilities} onSaved={done} />
        <div className="flex flex-col gap-5">
          <StaffPinCard />
          {booths.map((b) => (
            <BoothCard key={b.id} booth={b} speakers={content.speakers.filter((s) => s.boothId === b.id)} canDelete={booths.length > 1} onSaved={done} />
          ))}
          <button type="button" className="min-h-12 rounded-2xl border-2 border-dashed border-[#a99a98] px-4 text-[15px] font-semibold" onClick={addBooth}>
            + Add booth
          </button>
          <FacilitiesCard facilities={content.facilities} onSaved={done} />
          <QuestionsCard questions={[...content.questions].sort((a, b) => a.sort - b.sort)} onSaved={done} />
        </div>
      </div>
    </section>
  )
}

/** One shared staff PIN: staff and runners sign in once at /staff and pick any booth. */
function StaffPinCard() {
  const [pin, setPin] = useState('')
  return (
    <div className="rounded-2xl border border-[#e4ddd0] bg-white p-4">
      <h2 className="text-[17px] font-bold">Staff PIN (all booths)</h2>
      <p className="mt-1 text-[14px] text-[#6b6058]">
        Staff and runners sign in once at <span className="font-mono">/staff</span> and choose the booth — switching booths needs no new sign-in. A new PIN signs out everyone using the old one.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="min-h-10 rounded-lg border border-[#d5cabd] px-3 font-semibold"
          onClick={async () => {
            if (confirm('Create a new shared staff PIN? Staff signed in with the old PIN will be signed out.')) setPin(await api.adminResetStaffMasterPin())
          }}
        >
          New staff PIN
        </button>
        {pin && (
          <span className="rounded-lg bg-[#fff7e0] px-3 py-2" role="alert">
            New staff PIN: <b className="font-mono text-[18px] tracking-[0.2em]">{pin}</b> (shown once)
          </span>
        )}
      </div>
    </div>
  )
}

// --- map editor ---------------------------------------------------------------

type Sel = { kind: 'booth' | 'facility'; id: string }

function MapEditor({ booths, facilities, onSaved }: { booths: Booth[]; facilities: Facility[]; onSaved: (m?: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [sel, setSel] = useState<Sel | null>(null)
  const [drag, setDrag] = useState<{ sel: Sel; x: number; y: number } | null>(null)
  const [size, setSize] = useState({ w: 400, h: 533 })
  // the visible part of the plan: centre + width in plan units (the height follows the panel's shape)
  const [cam, setCam] = useState({ cx: LOUNGE_BOUNDS.x + LOUNGE_BOUNDS.w / 2, cy: LOUNGE_BOUNDS.y + LOUNGE_BOUNDS.h / 2, w: LOUNGE_BOUNDS.w + 600 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ kind: 'pan'; sx: number; sy: number; cx: number; cy: number; moved: boolean } | { kind: 'pinch'; d: number; w: number } | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const read = () => setSize({ w: el.clientWidth || 400, h: el.clientHeight || 533 })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const camH = cam.w * (size.h / size.w)
  const view: Rect = { x: cam.cx - cam.w / 2, y: cam.cy - camH / 2, w: cam.w, h: camH }
  const upp = cam.w / size.w // plan units per screen pixel
  const k = upp / 3.2 // markers keep the on-screen size they have in the Lounge view whatever the zoom

  const clampCam = (c: typeof cam) => {
    const w = Math.max(250, Math.min(2800, c.w))
    return { w, cx: Math.max(-200, Math.min(PLAN.w + 200, c.cx)), cy: Math.max(-200, Math.min(PLAN.h + 200, c.cy)) }
  }
  const zoomAt = (factor: number, px?: { x: number; y: number }) =>
    setCam((c) => {
      const w = Math.max(250, Math.min(2800, c.w * factor))
      const real = w / c.w
      // keep the plan point under the cursor where it is
      const p = px ?? { x: c.cx, y: c.cy }
      return clampCam({ w, cx: p.x - (p.x - c.cx) * real, cy: p.y - (p.y - c.cy) * real })
    })
  const showLounge = () => setCam({ cx: LOUNGE_BOUNDS.x + LOUNGE_BOUNDS.w / 2, cy: LOUNGE_BOUNDS.y + LOUNGE_BOUNDS.h / 2, w: LOUNGE_BOUNDS.w + 600 })
  const showBuilding = () => setCam({ cx: PLAN.w / 2, cy: PLAN.h / 2, w: (PLAN.h + 160) * (size.w / size.h) })

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: Math.round(p.x), y: Math.round(p.y) }
  }

  const commit = async (s: Sel, x: number, y: number) => {
    if (s.kind === 'booth') {
      const b = booths.find((v) => v.id === s.id)!
      await api.adminUpsertBooth({ ...b, x, y })
    } else {
      const f = facilities.find((v) => v.id === s.id)!
      await api.adminUpsertFacility({ ...f, x, y })
    }
    onSaved('Point moved')
  }

  const pos = (s: Sel, x: number | null, y: number | null) => (drag && drag.sel.id === s.id && drag.sel.kind === s.kind ? { x: drag.x, y: drag.y } : { x, y })

  // drag the background to pan, pinch / wheel / buttons to zoom
  const down = (e: React.PointerEvent) => {
    svgRef.current?.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), w: cam.w }
    } else if (pointers.current.size === 1) {
      gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.cx, cy: cam.cy, moved: false }
    }
  }
  const move = (e: React.PointerEvent) => {
    if (drag) return setDrag({ ...drag, ...toSvg(e) })
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch' && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d > 10) setCam((c) => clampCam({ ...c, w: g.w * (g.d / d) }))
      moved.current = true
    } else if (g.kind === 'pan') {
      const dx = e.clientX - g.sx
      const dy = e.clientY - g.sy
      if (Math.hypot(dx, dy) > 4) moved.current = true
      if (moved.current) setCam((c) => clampCam({ ...c, cx: g.cx - dx * upp, cy: g.cy - dy * upp }))
    }
  }
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2 && gesture.current?.kind === 'pinch') gesture.current = null
    if (pointers.current.size === 0) gesture.current = null
    if (drag) {
      commit(drag.sel, drag.x, drag.y)
      setTimeout(() => setDrag(null), 0)
    }
  }

  const pickBtn = 'min-h-9 min-w-9 rounded-lg border border-[#d5cabd] bg-white px-2 text-[15px] font-semibold'

  return (
    <div className={`${card} h-fit xl:sticky xl:top-5`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">Map points</h2>
        <div className="flex gap-1.5">
          <button type="button" className="min-h-10 rounded-lg border border-[#d5cabd] px-3 text-[13px]" onClick={showLounge}>
            Lounge
          </button>
          <button type="button" className="min-h-10 rounded-lg border border-[#d5cabd] px-3 text-[13px]" onClick={showBuilding}>
            Whole building
          </button>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-[#6b6058]">Drag a point to move it, or pick an item below and click the map to place it. Drag the map to pan; scroll, pinch or use + / − to zoom.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...booths.map((b) => ({ kind: 'booth' as const, id: b.id, label: `${b.id} ${b.nama}` })), ...facilities.map((f) => ({ kind: 'facility' as const, id: f.id, label: `${f.label}${f.x == null ? ' (not placed)' : ''}` }))].map((it) => (
          <button
            key={it.kind + it.id}
            type="button"
            onClick={() => setSel({ kind: it.kind, id: it.id })}
            className={`min-h-9 rounded-full border px-3 text-[13px] ${sel?.id === it.id && sel.kind === it.kind ? 'border-navy bg-navy text-white' : 'border-[#d5cabd]'}`}
          >
            {it.label}
          </button>
        ))}
      </div>
      {sel && <p className="mt-2 rounded-lg bg-[#fff7e0] px-3 py-1.5 text-[13px]">Click anywhere on the map to put “{sel.kind === 'booth' ? booths.find((b) => b.id === sel.id)?.nama : facilities.find((f) => f.id === sel.id)?.label}” there.</p>}
      <div className="panel-red relative mt-3 overflow-hidden rounded-xl">
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
          <button type="button" className={pickBtn} aria-label="Zoom in" onClick={() => zoomAt(0.7)}>
            +
          </button>
          <button type="button" className={pickBtn} aria-label="Zoom out" onClick={() => zoomAt(1 / 0.7)}>
            −
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={viewBoxOf(view)}
          className="block aspect-[3/4] w-full cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={(e) => {
            e.preventDefault()
            zoomAt(Math.exp(e.deltaY * 0.0015), toSvg(e))
          }}
          onClick={(e) => {
            if (!sel || drag || moved.current) return
            const p = toSvg(e)
            commit(sel, p.x, p.y)
          }}
          role="application"
          aria-label="Map point editor"
        >
          <g className="text-cream" style={{ opacity: 0.5 }} dangerouslySetInnerHTML={{ __html: WALLS_INNER }} />
          <rect x={LOUNGE_BOUNDS.x} y={LOUNGE_BOUNDS.y} width={LOUNGE_BOUNDS.w} height={LOUNGE_BOUNDS.h} fill="none" stroke="#F9B018" strokeWidth="8" strokeDasharray="30 20" />
          {booths.map((b) => {
            const s: Sel = { kind: 'booth', id: b.id }
            const p = pos(s, b.x, b.y)
            const active = sel?.id === b.id && sel.kind === 'booth'
            return (
              <g
                key={b.id}
                transform={`translate(${p.x ?? 0} ${p.y ?? 0}) scale(${k})`}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  ;(e.target as Element).setPointerCapture?.(e.pointerId)
                  setSel(s)
                  setDrag({ sel: s, x: p.x!, y: p.y! })
                }}
              >
                <path d={pinPath(0, 0)} fill={active ? '#F9B018' : '#D22B26'} stroke="#fff" strokeWidth="8" />
                <text y={-30} textAnchor="middle" fontFamily="Anton" fontSize="44" fill="#fff">
                  {b.id}
                </text>
              </g>
            )
          })}
          {facilities
            .filter((f) => f.x != null)
            .map((f) => {
              const s: Sel = { kind: 'facility', id: f.id }
              const p = pos(s, f.x, f.y)
              const active = sel?.id === f.id && sel.kind === 'facility'
              return (
                <g
                  key={f.id}
                  transform={`translate(${p.x ?? 0} ${p.y ?? 0}) scale(${k})`}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    ;(e.target as Element).setPointerCapture?.(e.pointerId)
                    setSel(s)
                    setDrag({ sel: s, x: p.x!, y: p.y! })
                  }}
                >
                  <circle r="60" fill={active ? '#F9B018' : '#F4E8E2'} stroke="#0D2A4A" strokeWidth="8" />
                  <text y="110" textAnchor="middle" fontFamily="Poppins" fontWeight="700" fontSize="56" fill="#F9B018">
                    {f.label}
                  </text>
                </g>
              )
            })}
        </svg>
      </div>
    </div>
  )
}

// --- booth + speakers ---------------------------------------------------------------

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={lbl}>{label}</span>
      {children}
    </label>
  )
}

function BoothCard({ booth, speakers, canDelete, onSaved }: { booth: Booth; speakers: Speaker[]; canDelete: boolean; onSaved: (m?: string) => void }) {
  const [b, setB] = useState(booth)
  const [pin, setPin] = useState<string | null>(null)
  // position is edited on the map; this form only owns the text/stamp fields
  const merged: Booth = { ...booth, nama: b.nama, region: b.region, slug: b.slug, stamp: b.stamp, placeholderPos: b.placeholderPos }
  const dirty = JSON.stringify(merged) !== JSON.stringify(booth)
  return (
    <div className={card}>
      <div className="flex items-start gap-4">
        <StampImg src={b.stamp} alt={`${b.nama} stamp`} className="h-20 w-20 flex-none" />
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <Field label={`Booth name (${b.id})`}>
            <input className="field-paper" value={b.nama} onChange={(e) => setB({ ...b, nama: e.target.value })} />
          </Field>
          <Field label="Region">
            <input className="field-paper" value={b.region} onChange={(e) => setB({ ...b, region: e.target.value })} />
          </Field>
          <Field label="Officer link slug">
            <input className="field-paper" value={b.slug} onChange={(e) => setB({ ...b, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px]">
        <label className="min-h-10 cursor-pointer rounded-lg border border-[#d5cabd] px-3 py-2">
          Replace stamp (PNG)
          <input type="file" accept="image/*" className="sr-only" onChange={async (e) => e.target.files?.[0] && setB({ ...b, stamp: await uploadImage(e.target.files[0], 720) })} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={b.placeholderPos} onChange={(e) => setB({ ...b, placeholderPos: e.target.checked })} />
          Position is a placeholder
        </label>
        <button
          type="button"
          className="min-h-10 rounded-lg border border-[#d5cabd] px-3"
          onClick={async () => {
            if (confirm(`Create a new officer PIN for ${b.nama}? Signed-in officers will be signed out.`)) setPin(await api.adminResetStaffPin(b.id))
          }}
        >
          Booth-only PIN
        </button>
        {pin && (
          <span className="rounded-lg bg-[#fff7e0] px-3 py-2" role="alert">
            New PIN: <b className="font-mono text-[18px] tracking-[0.2em]">{pin}</b> (shown once)
          </span>
        )}
        {canDelete && (
          <button
            type="button"
            className="min-h-10 text-[#9b2c2c] underline"
            onClick={async () => {
              const typed = prompt(`Delete the booth "${booth.nama}"? Its speakers, officer PIN and every participant's stamp and notes for this booth are removed. This cannot be undone.

Type the booth name to confirm:`)
              if (typed === null) return
              if (typed.trim().toLowerCase() !== booth.nama.trim().toLowerCase()) return alert('The name did not match — nothing was deleted.')
              try {
                await api.adminDeleteBooth(booth.id)
                onSaved('Booth deleted')
              } catch (e) {
                alert((e as Error).message)
              }
            }}
          >
            Delete booth
          </button>
        )}
        <button type="button" className="btn btn-red ml-auto min-h-10 text-[14px]" disabled={!dirty} onClick={async () => (await api.adminUpsertBooth(merged), onSaved())}>
          Save booth
        </button>
      </div>

      <div className="mt-4 border-t border-[#efe9df] pt-4">
        <p className="text-[15px] font-bold">Speakers</p>
        {speakers.map((s) => (
          <SpeakerForm key={s.id} speaker={s} onSaved={onSaved} />
        ))}
        <button
          type="button"
          className="mt-3 min-h-10 rounded-lg border border-dashed border-[#a99a98] px-3 text-[14px]"
          onClick={async () => {
            await api.adminUpsertSpeaker({ id: `${b.id}-s${Date.now().toString(36)}`, boothId: b.id, nama: 'New speaker', universitas: '', program: '', foto: null, cerita: '', placeholder: true })
            onSaved('Speaker added')
          }}
        >
          + Add speaker
        </button>
      </div>
    </div>
  )
}

function SpeakerForm({ speaker, onSaved }: { speaker: Speaker; onSaved: (m?: string) => void }) {
  const [s, setS] = useState(speaker)
  const dirty = JSON.stringify(s) !== JSON.stringify(speaker)
  const [picked, setPicked] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <div className="mt-3 grid gap-3 rounded-xl bg-[#faf8f4] p-3 sm:grid-cols-[120px_1fr]">
      <div className="flex flex-col items-center gap-1 text-[12px]">
        <div className="aspect-[4/3.2] w-full overflow-hidden rounded bg-[#3a3f4a]">{s.foto && <img src={s.foto} alt="" className="h-full w-full object-cover" />}</div>
        <label className="flex min-h-10 cursor-pointer items-center rounded-lg border border-[#d5cabd] bg-white px-3 font-semibold">
          {busy ? 'Uploading…' : s.foto ? 'Replace photo' : 'Add photo'}
          <input
            type="file"
            accept="image/*,.heic,.heif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) {
                setPicked(f)
                setNote(null)
              }
            }}
          />
        </label>
        {note && (
          <span className={note.ok ? 'text-[#256b3a]' : 'text-[#9b2c2c]'} role="status">
            {note.text}
          </span>
        )}
      </div>
      {picked && (
        <PhotoCropDialog
          file={picked}
          onCancel={() => setPicked(null)}
          onDone={async (blob) => {
            setPicked(null)
            setBusy(true)
            try {
              const url = await api.uploadContentImage(blob, 'jpg')
              setS((p) => ({ ...p, foto: url }))
              setNote({ ok: true, text: 'Photo uploaded. Press Save speaker to keep it.' })
            } catch (x) {
              setNote({ ok: false, text: (x as Error).message || 'Upload failed. Try again.' })
            }
            setBusy(false)
          }}
        />
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Name">
          <input className="field-paper" value={s.nama} onChange={(e) => setS({ ...s, nama: e.target.value })} />
        </Field>
        <Field label="University">
          <input className="field-paper" value={s.universitas} onChange={(e) => setS({ ...s, universitas: e.target.value })} />
        </Field>
        <Field label="Program">
          <input className="field-paper" value={s.program} onChange={(e) => setS({ ...s, program: e.target.value })} />
        </Field>
        <div className="sm:col-span-3">
          <Field label="Short story (2–3 sentences)">
            <textarea rows={2} className="field-paper resize-y" value={s.cerita} onChange={(e) => setS({ ...s, cerita: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[14px] sm:col-span-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={s.placeholder} onChange={(e) => setS({ ...s, placeholder: e.target.checked })} />
            Still a placeholder
          </label>
          <button
            type="button"
            className="min-h-10 text-[#9b2c2c] underline"
            onClick={async () => {
              if (confirm(`Delete speaker ${s.nama}?`)) {
                await api.adminDeleteSpeaker(s.id)
                onSaved('Speaker deleted')
              }
            }}
          >
            Delete
          </button>
          <button type="button" className="btn btn-red ml-auto min-h-10 text-[14px]" disabled={!dirty} onClick={async () => (await api.adminUpsertSpeaker(s), onSaved())}>
            Save speaker
          </button>
        </div>
      </div>
    </div>
  )
}

// --- facilities & questions ---------------------------------------------------------------

function FacilitiesCard({ facilities, onSaved }: { facilities: Facility[]; onSaved: (m?: string) => void }) {
  return (
    <div className={card}>
      <h2 className="text-[17px] font-bold">Facilities</h2>
      {facilities.map((f) => (
        <FacilityRow key={f.id} f={f} onSaved={onSaved} />
      ))}
      <button
        type="button"
        className="mt-3 min-h-10 rounded-lg border border-dashed border-[#a99a98] px-3 text-[14px]"
        onClick={async () => {
          await api.adminUpsertFacility({ id: `F${Date.now().toString(36)}`, jenis: 'lainnya', label: 'Facility', x: null, y: null, placeholder: true })
          onSaved('Facility added')
        }}
      >
        + Add facility
      </button>
    </div>
  )
}

function FacilityRow({ f: initial, onSaved }: { f: Facility; onSaved: (m?: string) => void }) {
  const [f, setF] = useState(initial)
  const merged: Facility = { ...initial, label: f.label, jenis: f.jenis }
  const dirty = JSON.stringify(merged) !== JSON.stringify(initial)
  return (
    <div className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_140px_auto]">
      <Field label="Label">
        <input className="field-paper" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      </Field>
      <Field label="Icon">
        <select className="field-paper" value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value })}>
          <option value="toilet">Restroom</option>
          <option value="musala">Prayer room</option>
          <option value="lainnya">Other</option>
        </select>
      </Field>
      <div className="flex flex-wrap gap-2">
        {f.x != null && (
          <button type="button" className="min-h-11 rounded-lg border border-[#d5cabd] px-3 text-[13px]" onClick={async () => (await api.adminUpsertFacility({ ...initial, x: null, y: null }), onSaved('Hidden from the map'))}>
            Hide
          </button>
        )}
        <button type="button" className="min-h-11 rounded-lg px-3 text-[13px] text-[#9b2c2c] underline" onClick={async () => confirm(`Delete ${f.label}?`) && (await api.adminDeleteFacility(f.id), onSaved('Deleted'))}>
          Delete
        </button>
        <button type="button" className="btn btn-red min-h-11 text-[14px]" disabled={!dirty} onClick={async () => (await api.adminUpsertFacility(merged), onSaved())}>
          Save
        </button>
      </div>
    </div>
  )
}

function QuestionsCard({ questions, onSaved }: { questions: Question[]; onSaved: (m?: string) => void }) {
  const [type, setType] = useState<Question['tipe']>('skala_1_5')
  const [err, setErr] = useState('')
  const run = async (fn: () => Promise<void>, msg?: string) => {
    setErr('')
    try {
      await fn()
      onSaved(msg)
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const add = () =>
    run(
      () =>
        api.adminUpsertQuestion({
          id: `q${Date.now().toString(36)}`,
          teks: type === 'skala_1_5' ? 'New rating question' : 'New open question',
          tipe: type,
          wajib: type === 'skala_1_5',
          sort: Math.max(0, ...questions.map((q) => q.sort)) + 1,
        }),
      'Question added — edit the text below',
    )
  const move = (i: number, d: -1 | 1) => {
    const ids = questions.map((q) => q.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    return run(() => api.adminSetQuestionOrder(ids))
  }
  return (
    <div className={card}>
      <h2 className="text-[17px] font-bold">Feedback questions ({questions.length})</h2>
      <p className="mt-1 text-[14px] text-[#6b6058]">Add as many as you need. Participants answer one question at a time, in this order. Scale questions are rated 1–5; open questions take free text.</p>
      {questions.map((q, i) => (
        <QuestionRow key={q.id} q={q} n={i + 1} first={i === 0} last={i === questions.length - 1} onMove={(d) => move(i, d)} onSaved={onSaved} onError={setErr} />
      ))}
      {!questions.length && <p className="mt-3 text-[14px] text-[#6b6058]">No questions — participants can submit without feedback.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#efe9df] pt-4">
        <label htmlFor="new-q-type" className="text-[14px] font-semibold">
          New question
        </label>
        <select id="new-q-type" className="field-paper max-w-[200px]" value={type} onChange={(e) => setType(e.target.value as Question['tipe'])}>
          <option value="skala_1_5">Scale 1–5</option>
          <option value="teks">Open text</option>
        </select>
        <button type="button" className="btn btn-red min-h-11 text-[14px]" onClick={add}>
          Add question
        </button>
      </div>
      {err && (
        <p className="mt-2 text-[14px] text-[#9b2c2c]" role="alert">
          {err}
        </p>
      )}
    </div>
  )
}

function QuestionRow({ q: initial, n, first, last, onMove, onSaved, onError }: { q: Question; n: number; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onSaved: (m?: string) => void; onError: (m: string) => void }) {
  const [q, setQ] = useState(initial)
  const dirty = q.teks !== initial.teks || q.wajib !== initial.wajib || (q.section ?? '') !== (initial.section ?? '') || (q.labelLow ?? '') !== (initial.labelLow ?? '') || (q.labelHigh ?? '') !== (initial.labelHigh ?? '')
  const btn = 'flex h-10 w-10 items-center justify-center rounded-lg border border-[#d5cabd] text-[16px] disabled:opacity-30'
  return (
    <div className="mt-3 rounded-xl border border-[#efe9df] p-3">
      <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto]">
        <Field label={`Question ${n} · ${q.tipe === 'skala_1_5' ? 'scale 1–5' : 'open text'}`}>
          <input className="field-paper" maxLength={240} value={q.teks} onChange={(e) => setQ({ ...q, teks: e.target.value })} />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-[14px]">
          <input type="checkbox" className="h-5 w-5" checked={q.wajib} onChange={(e) => setQ({ ...q, wajib: e.target.checked })} />
          Required
        </label>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Section title (optional, shown above the question)">
          <input className="field-paper" maxLength={160} value={q.section ?? ''} onChange={(e) => setQ({ ...q, section: e.target.value })} />
        </Field>
        {q.tipe === 'skala_1_5' && (
          <>
            <Field label="Label for 1">
              <input className="field-paper" maxLength={40} placeholder="Poor" value={q.labelLow ?? ''} onChange={(e) => setQ({ ...q, labelLow: e.target.value })} />
            </Field>
            <Field label="Label for 5">
              <input className="field-paper" maxLength={40} placeholder="Excellent" value={q.labelHigh ?? ''} onChange={(e) => setQ({ ...q, labelHigh: e.target.value })} />
            </Field>
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} aria-label={`Move question ${n} up`} disabled={first} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className={btn} aria-label={`Move question ${n} down`} disabled={last} onClick={() => onMove(1)}>
          ↓
        </button>
        <button
          type="button"
          className="min-h-10 rounded-lg border border-[#e7b7b3] px-3 text-[14px] font-semibold text-[#9b2c2c]"
          onClick={async () => {
            if (!confirm(`Delete question ${n}? Answers already given to it are deleted too.`)) return
            try {
              await api.adminDeleteQuestion(q.id)
              onSaved('Question deleted')
            } catch (e) {
              onError((e as Error).message)
            }
          }}
        >
          Delete
        </button>
        <button
          type="button"
          className="btn btn-red ml-auto min-h-10 text-[14px]"
          disabled={!dirty}
          onClick={async () => {
            try {
              await api.adminUpsertQuestion(q)
              onSaved()
            } catch (e) {
              onError((e as Error).message)
            }
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
