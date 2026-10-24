import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'
import type { Booth, Facility, RoomLabel } from '../data/types'
import { CAM_BUILDING, CAM_LOUNGE, LOUNGE_BOUNDS, WALLS_INNER, cameraTransform, lerpRect, viewBoxOf } from './geometry'
import { boothCode } from '../booklet/print'

export type BoothStatus = 'none' | 'stamped' | 'done'
export type MapMode = 'lounge' | 'building'

const EASE_OUT = [0.22, 1, 0.36, 1] as const
const INK = '#e05a50' // stamp red as printed on the dark map sheet

interface Props {
  mode: MapMode
  booths: Booth[]
  facilities: Facility[]
  rooms: RoomLabel[]
  status: Record<string, BoothStatus>
  onPin?: (boothId: string, el: Element) => void
  onLounge?: () => void
  className?: string
}

/**
 * One printed map sheet for both views; Lounge ↔ Whole building animates the camera transform of a
 * single group (MOTION #6). Pins are one shape: a small round ink stamp; colour only means status.
 */
export function MapView({ mode, booths, facilities, rooms, status, onPin, onLounge, className = '' }: Props) {
  const reduce = useReducedMotion()
  const t = useMotionValue(mode === 'building' ? 1 : 0)
  const camRef = useRef<SVGGElement>(null)
  const sBuilding = cameraTransform(CAM_LOUNGE, CAM_BUILDING).s

  useEffect(() => {
    const c = animate(t, mode === 'building' ? 1 : 0, { duration: reduce ? 0 : 0.4, ease: EASE_OUT })
    return () => c.stop()
  }, [mode, reduce, t])

  const apply = (v: number) => camRef.current?.setAttribute('transform', cameraTransform(CAM_LOUNGE, lerpRect(CAM_LOUNGE, CAM_BUILDING, v)).str)
  useMotionValueEvent(t, 'change', apply)
  useEffect(() => {
    apply(t.get())
  })

  const loungeOpacity = useTransform(t, [0, 0.6], [1, 0])
  const buildingOpacity = useTransform(t, [0.4, 1], [0, 1])
  const fo = rooms.find((r) => r.pintu_masuk)
  const px = 1 / (sBuilding * 0.24) // user units per screen px in building view
  const L = LOUNGE_BOUNDS

  return (
    <svg viewBox={viewBoxOf(CAM_LOUNGE)} preserveAspectRatio="xMidYMid meet" className={className} role="group" aria-label={mode === 'lounge' ? 'Lounge map with booth pins' : 'Whole Global Kampong building map'}>
      <style>{`.mv-walls * { vector-effect: non-scaling-stroke; stroke-width: 1.2px; } .mv-walls rect[fill="currentColor"]:not([fill-opacity]) { fill: none; stroke: currentColor; }`}</style>
      <g ref={camRef}>
        <g className="mv-walls text-cream" style={{ opacity: 0.62 }} dangerouslySetInnerHTML={{ __html: WALLS_INNER }} />

        {/* Lounge: dashed yellow outline (lounge view) ↔ red outline (building view) */}
        <motion.rect x={L.x + 22} y={L.y + 16} width={L.w - 44} height={L.h - 32} rx="6" fill="#F9B018" fillOpacity="0.05" stroke="#F9B018" strokeOpacity="0.85" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeDasharray="7 5" style={{ opacity: loungeOpacity }} />
        <motion.rect
          x={L.x}
          y={L.y}
          width={L.w}
          height={L.h}
          rx="6"
          fill="#3a1218"
          fillOpacity="0.85"
          stroke={INK}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ opacity: buildingOpacity, cursor: onLounge ? 'pointer' : undefined }}
          onClick={mode === 'building' ? onLounge : undefined}
        />
        <text x={L.x + L.w / 2} y={L.y + L.h - 146} textAnchor="middle" fontFamily="Libre Baskerville" fontWeight="700" fontSize="104" letterSpacing="14" fill="#F9B018" stroke="#1a0f0c" strokeWidth="12" strokeLinejoin="round" paintOrder="stroke">
          LOUNGE
        </text>
        {fo && (
          <motion.text style={{ opacity: loungeOpacity }} x={fo.x} y={L.y + L.h - 52} textAnchor="middle" fontFamily="Poppins" fontWeight="600" fontSize="46" fill="#F4E8E2" fillOpacity="0.9" stroke="#1a0f0c" strokeWidth="8" strokeLinejoin="round" paintOrder="stroke">
            ↓ Front Office · entrance
          </motion.text>
        )}

        {/* building-only: room labels, entrance, facilities, booth dots */}
        <motion.g style={{ opacity: buildingOpacity }} pointerEvents={mode === 'building' ? 'auto' : 'none'}>
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
            return <circle key={b.id} cx={b.x} cy={b.y} r={6 * px} fill={st === 'none' ? 'none' : INK} stroke={INK} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          })}
        </motion.g>

        {/* lounge-only: ink-stamp pins */}
        <motion.g style={{ opacity: loungeOpacity }} pointerEvents={mode === 'lounge' ? 'auto' : 'none'}>
          {booths.map((b) => {
            const st = status[b.id] ?? 'none'
            const filled = st !== 'none'
            return (
              <motion.g
                key={b.id}
                data-tour={b.id === booths[0]?.id ? 'pin' : undefined}
                role="button"
                tabIndex={mode === 'lounge' ? 0 : -1}
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
