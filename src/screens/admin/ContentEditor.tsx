import { useRef, useState, type ReactNode } from 'react'
import { api } from '../../data/api'
import { useContent } from '../../app/providers'
import type { Booth, Facility, Question, Speaker } from '../../data/types'
import { CAM_BUILDING, LOUNGE_BOUNDS, WALLS_INNER, pinPath, viewBoxOf } from '../../map/geometry'
import { StampImg } from '../../components/decor'

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
  if (!content) return <div className="p-8">Loading…</div>
  const done = (m = 'Saved') => {
    reload()
    setSaved(m)
    setTimeout(() => setSaved(''), 1800)
  }
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)

  return (
    <section className="p-5 md:p-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[28px] font-extrabold">Booths & content</h1>
        {saved && <span className="rounded-full bg-[#e3f3e6] px-3 py-1 text-[14px] font-bold text-[#2e7d32]">{saved}</span>}
      </div>
      <p className="mt-1 text-[14px] text-[#6b6058]">Every change shows up on participants’ phones right away (no redeploy).</p>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <MapEditor booths={booths} facilities={content.facilities} onSaved={done} />
        <div className="flex flex-col gap-5">
          <StaffPinCard />
          {booths.map((b) => (
            <BoothCard key={b.id} booth={b} speakers={content.speakers.filter((s) => s.boothId === b.id)} onSaved={done} />
          ))}
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
  const [zoomLounge, setZoomLounge] = useState(true)
  const view = zoomLounge ? { x: LOUNGE_BOUNDS.x - 300, y: LOUNGE_BOUNDS.y - 200, w: LOUNGE_BOUNDS.w + 600, h: LOUNGE_BOUNDS.h + 400 } : CAM_BUILDING

  const toSvg = (e: React.PointerEvent | React.MouseEvent) => {
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

  return (
    <div className={`${card} h-fit xl:sticky xl:top-5`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold">Map points</h2>
        <button type="button" className="min-h-10 rounded-lg border border-[#d5cabd] px-3 text-[13px]" onClick={() => setZoomLounge((z) => !z)}>
          {zoomLounge ? 'Whole building' : 'Zoom to Lounge'}
        </button>
      </div>
      <p className="mt-1 text-[13px] text-[#6b6058]">Drag a point, or pick an item and click the map to place it.</p>
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
      <div className="panel-red mt-3 overflow-hidden rounded-xl">
        <svg
          ref={svgRef}
          viewBox={viewBoxOf(view)}
          className="block aspect-[3/4] w-full touch-none select-none"
          onClick={(e) => {
            if (!sel || drag) return
            const p = toSvg(e)
            commit(sel, p.x, p.y)
          }}
          onPointerMove={(e) => drag && setDrag({ ...drag, ...toSvg(e) })}
          onPointerUp={() => {
            if (drag) {
              commit(drag.sel, drag.x, drag.y)
              setTimeout(() => setDrag(null), 0)
            }
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
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  ;(e.target as Element).setPointerCapture?.(e.pointerId)
                  setSel(s)
                  setDrag({ sel: s, x: p.x!, y: p.y! })
                }}
              >
                <path d={pinPath(p.x!, p.y!)} fill={active ? '#F9B018' : '#D22B26'} stroke="#fff" strokeWidth="8" />
                <text x={p.x!} y={p.y! - 30} textAnchor="middle" fontFamily="Anton" fontSize="44" fill="#fff">
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
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setSel(s)
                    setDrag({ sel: s, x: p.x!, y: p.y! })
                  }}
                >
                  <circle cx={p.x!} cy={p.y!} r="60" fill={active ? '#F9B018' : '#F4E8E2'} stroke="#0D2A4A" strokeWidth="8" />
                  <text x={p.x!} y={p.y! + 110} textAnchor="middle" fontFamily="Poppins" fontWeight="700" fontSize="56" fill="#F9B018">
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

function BoothCard({ booth, speakers, onSaved }: { booth: Booth; speakers: Speaker[]; onSaved: (m?: string) => void }) {
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
  return (
    <div className="mt-3 grid gap-3 rounded-xl bg-[#faf8f4] p-3 sm:grid-cols-[80px_1fr]">
      <label className="flex cursor-pointer flex-col items-center gap-1 text-[12px]">
        <div className="aspect-[4/5] w-20 overflow-hidden rounded bg-[#3a3f4a]">{s.foto && <img src={s.foto} alt="" className="h-full w-full object-cover" />}</div>
        Replace photo
        <input type="file" accept="image/*" className="sr-only" onChange={async (e) => e.target.files?.[0] && setS({ ...s, foto: await uploadImage(e.target.files[0]) })} />
      </label>
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
  return (
    <div className={card}>
      <h2 className="text-[17px] font-bold">Feedback questions</h2>
      {questions.map((q, i) => (
        <QuestionRow key={q.id} q={q} n={i + 1} onSaved={onSaved} />
      ))}
    </div>
  )
}

function QuestionRow({ q: initial, n, onSaved }: { q: Question; n: number; onSaved: (m?: string) => void }) {
  const [q, setQ] = useState(initial)
  const dirty = JSON.stringify(q) !== JSON.stringify(initial)
  return (
    <div className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
      <Field label={`Question ${n} (${q.tipe === 'skala_1_5' ? 'scale 1–5' : 'text'})`}>
        <input className="field-paper" value={q.teks} onChange={(e) => setQ({ ...q, teks: e.target.value })} />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-[14px]">
        <input type="checkbox" className="h-5 w-5" checked={q.wajib} onChange={(e) => setQ({ ...q, wajib: e.target.checked })} />
        Required
      </label>
      <button type="button" className="btn btn-red min-h-11 text-[14px]" disabled={!dirty} onClick={async () => (await api.adminUpsertQuestion(q), onSaved())}>
        Save
      </button>
    </div>
  )
}
