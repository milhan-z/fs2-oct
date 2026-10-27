import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import type { Booth, Facility, RoomLabel } from '../data/types'
import { CAM_BUILDING, CAM_LOUNGE, WALLS_INNER, cameraTransform, lerpRect, roomAt, roomCamera, viewBoxOf, type Rect } from './geometry'
import { boothCode } from '../booklet/print'

export type BoothStatus = 'none' | 'stamped' | 'done'
/** 'building' (the whole plan) or the label of a room with `batas` (Lounge, Partnership, …) */
export type MapMode = string
export const BUILDING: MapMode = 'building'

const EASE_OUT = [0.22, 1, 0.36, 1] as const
const INK = '#e05a50' // stamp red as printed on the dark map sheet

interface Props {
  mode: MapMode
  booths: Booth[]
  facilities: Facility[]
  rooms: RoomLabel[]
  status: Record<string, BoothStatus>
  onPin?: (boothId: string, el: Element) => void
  /** a room was tapped on the whole-building view */
  onRoom?: (label: string) => void
  className?: string
}

/**
 * One printed map sheet for every view; moving between the whole building and a room (Lounge, Partnership)
 * animates the camera transform of a single group (MOTION #6). Pins are one shape: a small round ink stamp;
 * colour only means status. Each room has its own layer of pins that is shown only while it is zoomed in.
 */
export function MapView({ mode, booths, facilities, rooms, status, onPin, onRoom, className = '' }: Props) {
  const reduce = useReducedMotion()
  const camRef = useRef<SVGGElement>(null)
  const sBuilding = cameraTransform(CAM_LOUNGE, CAM_BUILDING).s
  const px = 1 / (sBuilding * 0.24) // user units per screen px in building view
  const zones = useMemo(() => rooms.filter((r) => r.batas), [rooms])
  const inZone = useMemo(() => {
    const m: Record<string, Booth[]> = {}
    for (const z of zones) m[z.label] = []
    for (const b of booths) {
      const z = roomAt(rooms, b.x, b.y)
      if (z) m[z].push(b)
    }
    return m
  }, [zones, booths, rooms])
  const fo = rooms.find((r) => r.pintu_masuk)
  const lounge = zones.find((z) => z.sorot)

  // camera: from wherever it is now to the target of the new mode
  const zone = zones.find((z) => z.label === mode)
  const target: Rect = mode === BUILDING || !zone ? CAM_BUILDING : roomCamera(zone, inZone[zone.label] ?? [])
  const targetKey = `${target.x},${target.y},${target.w},${target.h}`
  const t = useMotionValue(1)
  const fromRect = useRef<Rect>(target)
  const curRect = useRef<Rect>(target)
  const toRect = useRef<Rect>(target)
  const apply = (v: number) => {
    curRect.current = lerpRect(fromRect.current, toRect.current, v)
    camRef.current?.setAttribute('transform', cameraTransform(CAM_LOUNGE, curRect.current).str)
  }
  useEffect(() => {
    fromRect.current = curRect.current
    toRect.current = target
    t.set(0)
    const c = animate(t, 1, { duration: reduce ? 0 : 0.4, ease: EASE_OUT })
    return () => c.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, reduce, t])
  useMotionValueEvent(t, 'change', apply)
  useEffect(() => {
    apply(t.get())
  })

  const fade = { duration: reduce ? 0 : 0.35 }
  const whole = mode === BUILDING || !zone

  return (
    <svg
      viewBox={viewBoxOf(CAM_LOUNGE)}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="group"
      aria-label={whole ? 'Whole Global Kampong building map' : `${zone!.label} map with booth pins`}
    >
      <style>{`.mv-walls * { vector-effect: non-scaling-stroke; stroke-width: 1.2px; } .mv-walls rect[fill="currentColor"]:not([fill-opacity]) { fill: none; stroke: currentColor; }`}</style>
      <g ref={camRef}>
        <g className="mv-walls text-cream" style={{ opacity: 0.62 }} dangerouslySetInnerHTML={{ __html: WALLS_INNER }} />

        {/* every room: dashed yellow outline while it is zoomed in ↔ red tinted block on the whole-building view */}
        {zones.map((z) => {
          const B = z.batas!
          const active = mode === z.label
          const n = inZone[z.label]?.length ?? 0
          return (
            <g key={z.label}>
              <motion.rect
                x={B.x + 22}
                y={B.y + 16}
                width={B.w - 44}
                height={B.h - 32}
                rx="6"
                fill="#F9B018"
                fillOpacity="0.05"
                stroke="#F9B018"
                strokeOpacity="0.85"
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="7 5"
                animate={{ opacity: active ? 1 : 0 }}
                transition={fade}
              />
              <motion.rect
                x={B.x}
                y={B.y}
                width={B.w}
                height={B.h}
                rx="6"
                fill="#3a1218"
                fillOpacity="0.85"
                stroke={INK}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                animate={{ opacity: whole ? 1 : 0 }}
                transition={fade}
                style={{ cursor: whole && onRoom ? 'pointer' : undefined }}
                onClick={whole ? () => onRoom?.(z.label) : undefined}
              />
              {z.sorot ? (
                <text x={B.x + B.w / 2} y={B.y + B.h - 146} textAnchor="middle" fontFamily="Libre Baskerville" fontWeight="700" fontSize="104" letterSpacing="14" fill="#F9B018" stroke="#1a0f0c" strokeWidth="12" strokeLinejoin="round" paintOrder="stroke" pointerEvents="none">
                  {z.label.toUpperCase()}
                </text>
              ) : (
                <text x={B.x + B.w / 2} y={B.y + 112} textAnchor="middle" fontFamily="Libre Baskerville" fontWeight="700" fontSize="56" letterSpacing="4" fill="#F9B018" stroke="#1a0f0c" strokeWidth="9" strokeLinejoin="round" paintOrder="stroke" pointerEvents="none">
                  {z.label.toUpperCase()}
                </text>
              )}
              {/* how many booths the room has, on the whole-building view */}
              <motion.text
                x={B.x + B.w / 2}
                y={z.sorot ? B.y + B.h - 60 : B.y + 190}
                textAnchor="middle"
                fontFamily="Poppins"
                fontWeight="600"
                fontSize="54"
                fill="#F4E8E2"
                stroke="#1a0f0c"
                strokeWidth="8"
                strokeLinejoin="round"
                paintOrder="stroke"
                pointerEvents="none"
                animate={{ opacity: whole ? 1 : 0 }}
                transition={fade}
              >
                {n} booth{n === 1 ? '' : 's'}
              </motion.text>
            </g>
          )
        })}
        {fo && lounge?.batas && (
          <motion.text
            animate={{ opacity: mode === lounge.label ? 1 : 0 }}
            transition={fade}
            x={fo.x}
            y={lounge.batas.y + lounge.batas.h - 52}
            textAnchor="middle"
            fontFamily="Poppins"
            fontWeight="600"
            fontSize="46"
            fill="#F4E8E2"
            fillOpacity="0.9"
            stroke="#1a0f0c"
            strokeWidth="8"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            ↓ Front Office · entrance
          </motion.text>
        )}

        {/* whole-building only: room labels, entrance, facilities, booth dots */}
        <motion.g animate={{ opacity: whole ? 1 : 0 }} transition={fade} pointerEvents="none">
          {rooms
            .filter((r) => !r.batas)
            .map((r) => (
              <text key={r.label} x={r.x} y={r.y} textAnchor="middle" fontFamily="Poppins" fontWeight="600" fontSize={12 * px} fill="#F4E8E2" fillOpacity="0.8">
                {r.label}
              </text>
            ))}
          {fo?.pintu_masuk && (
            <g>
              <circle cx={fo.pintu_masuk.x} cy={fo.pintu_masuk.y} r={5 * px} fill={INK} />
              <text x={fo.pintu_masuk.x - 9 * px} y={fo.pintu_masuk.y + 14 * px} textAnchor="end" fontFamily="Poppins" fontWeight="600" fontSize={11 * px} fill="#F4E8E2">
                Entrance
              </text>
            </g>
          )}
          {facilities
            .filter((f) => f.x != null && f.y != null)
            .map((f) => (
              <g key={f.id} role="img" aria-label={f.label}>
                <rect x={f.x! - 11 * px} y={f.y! - 11 * px} width={22 * px} height={22 * px} rx={3 * px} fill="#F3EBDD" />
                <FacilityGlyph jenis={f.jenis} x={f.x!} y={f.y!} r={11 * px} />
                <text x={f.x!} y={f.y! + 26 * px} textAnchor="middle" fontFamily="Poppins" fontWeight="600" fontSize={11 * px} fill="#F9B018">
                  {f.label}
                </text>
              </g>
            ))}
          {booths.map((b) => {
            const st = status[b.id] ?? 'none'
            return <circle key={b.id} cx={b.x} cy={b.y} r={8 * px} fill={st === 'none' ? 'none' : INK} stroke={INK} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          })}
        </motion.g>

        {/* one layer of ink-stamp pins per room, shown while that room is zoomed in */}
        {zones.map((z) => {
          const active = mode === z.label
          return (
            <motion.g key={z.label} animate={{ opacity: active ? 1 : 0 }} transition={fade} pointerEvents={active ? 'auto' : 'none'}>
              {(inZone[z.label] ?? []).map((b) => {
                const st = status[b.id] ?? 'none'
                const filled = st !== 'none'
                return (
                  <motion.g
                    key={b.id}
                    data-tour={b.id === booths[0]?.id ? 'pin' : undefined}
                    role="button"
                    tabIndex={active ? 0 : -1}
                    aria-label={`${b.nama} booth: ${st === 'none' ? 'not stamped yet' : st === 'stamped' ? 'stamped' : 'notes done'}`}
                    style={{ cursor: 'pointer', originX: 0.5, originY: 0.5 }}
                    onClick={(e) => onPin?.(b.id, e.currentTarget)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPin?.(b.id, e.currentTarget)}
                    whileTap={{ scale: 0.94 }}
                    transition={{ duration: 0.06 }}
                  >
                    <circle cx={b.x} cy={b.y} r="110" fill="transparent" />
                    <circle cx={b.x} cy={b.y} r="62" fill={filled ? INK : '#1e1214'} fillOpacity={filled ? 0.92 : 0.7} stroke={INK} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                    <circle cx={b.x} cy={b.y} r="50" fill="none" stroke={filled ? '#fbf3ea' : INK} strokeOpacity="0.6" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                    <text x={b.x} y={b.y + 22} textAnchor="middle" fontFamily="Anton" fontSize="60" fill="#fbf3ea">
                      {boothCode(b.nama, b.sort)}
                    </text>
                    {st === 'done' && <path d={`M${b.x + 36} ${b.y + 40} l20 20 l40 -52`} fill="none" stroke="#7fd18a" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
                    <text x={b.x} y={b.y + 112} textAnchor="middle" fontFamily="Poppins" fontWeight="600" fontSize="38" fill="#F4E8E2" fillOpacity="0.8">
                      {b.nama}
                    </text>
                  </motion.g>
                )
              })}
            </motion.g>
          )
        })}
      </g>
    </svg>
  )
}

function FacilityGlyph({ jenis, x, y, r }: { jenis: string; x: number; y: number; r: number }) {
  const k = r / 13
  if (jenis === 'toilet')
    return (
      <g transform={`translate(${x - 12 * k} ${y - 12 * k}) scale(${k})`} fill="#0D2A4A">
        <circle cx="7" cy="4" r="2" />
        <circle cx="17" cy="4" r="2" />
        <path d="M5 7h4l1 7H8v8H6v-8H4zM14.5 7h5l2 8h-2.5v7h-4v-7H12.5z" />
      </g>
    )
  if (jenis === 'musala')
    return (
      <g transform={`translate(${x - 12 * k} ${y - 12 * k}) scale(${k})`} fill="#0D2A4A">
        <path d="M12 2c3 2.5 5 4.5 5 7H7c0-2.5 2-4.5 5-7zM5 10h14v12H14v-5a2 2 0 0 0-4 0v5H5z" />
      </g>
    )
  return <circle cx={x} cy={y} r={r * 0.35} fill="#0D2A4A" />
}
