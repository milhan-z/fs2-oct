import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'
import type { Booth, Facility, RoomLabel } from '../data/types'
import { CAM_BUILDING, CAM_LOUNGE, LOUNGE_BOUNDS, WALLS_INNER, cameraTransform, lerpRect, pinLabel, pinPath, viewBoxOf } from './geometry'
import { EASE_OUT } from '../motion/presets'

export type BoothStatus = 'none' | 'stamped' | 'done'
export type MapMode = 'lounge' | 'building'

const PIN_FILL: Record<BoothStatus, string> = { none: '#1a0a0c', stamped: '#D22B26', done: '#43A047' }
const DOT_FILL: Record<BoothStatus, string> = { none: '#1a0a0c', stamped: '#D22B26', done: '#43A047' }

interface Props {
  mode: MapMode
  booths: Booth[]
  facilities: Facility[]
  rooms: RoomLabel[]
  status: Record<string, BoothStatus>
  onPin?: (boothId: string) => void
  onLounge?: () => void
  /** pins drop in on first render */
  dropPins?: boolean
  className?: string
}

/**
 * One SVG for both views; switching Lounge ↔ Seluruh gedung animates the camera
 * transform of a single group (MOTION #6), never swaps images.
 */
export function MapView({ mode, booths, facilities, rooms, status, onPin, onLounge, dropPins = false, className = '' }: Props) {
  const reduce = useReducedMotion()
  const t = useMotionValue(mode === 'building' ? 1 : 0)
  const camRef = useRef<SVGGElement>(null)
  const sBuilding = cameraTransform(CAM_LOUNGE, CAM_BUILDING).s

  useEffect(() => {
    const target = mode === 'building' ? 1 : 0
    const c = animate(t, target, { duration: reduce ? 0 : 0.4, ease: EASE_OUT })
    return () => c.stop()
  }, [mode, reduce, t])

  const apply = (v: number) => camRef.current?.setAttribute('transform', cameraTransform(CAM_LOUNGE, lerpRect(CAM_LOUNGE, CAM_BUILDING, v)).str)
  useMotionValueEvent(t, 'change', apply)
  useEffect(() => {
    apply(t.get())
  })

  const loungeOpacity = useTransform(t, [0, 0.6], [1, 0])
  const buildingOpacity = useTransform(t, [0.4, 1], [0, 1])
  const loungeRoom = rooms.find((r) => r.batas)
  const fo = rooms.find((r) => r.pintu_masuk)
  const labelSize = 13 / (sBuilding * 0.262) // ≈13 px on a phone-sized panel
  const dotR = 10 / (sBuilding * 0.262)
  const iconR = 15 / (sBuilding * 0.262)
  const L = LOUNGE_BOUNDS

  return (
    <svg viewBox={viewBoxOf(CAM_LOUNGE)} preserveAspectRatio="xMidYMid meet" className={className} role="group" aria-label={mode === 'lounge' ? 'Lounge map with booth pins' : 'Whole Global Kampong building map'}>
      <g ref={camRef}>
        {/* walls */}
        <g className="text-cream" style={{ opacity: 0.55 }} dangerouslySetInnerHTML={{ __html: WALLS_INNER }} />

        {/* Lounge highlight: dashed yellow (lounge view) ↔ red outline (building view) */}
        <motion.rect x={L.x + 22} y={L.y + 16} width={L.w - 44} height={L.h - 32} rx="24" fill="#F9B018" fillOpacity="0.07" stroke="#F9B018" strokeOpacity="0.85" strokeWidth="9" strokeDasharray="36 24" style={{ opacity: loungeOpacity }} />
        <motion.rect
          x={L.x}
          y={L.y}
          width={L.w}
          height={L.h}
          rx="20"
          fill="#3a1218"
          stroke="#E82020"
          strokeWidth="22"
          style={{ opacity: buildingOpacity, cursor: onLounge ? 'pointer' : undefined }}
          onClick={mode === 'building' ? onLounge : undefined}
        />
        {loungeRoom && (
          <text x={loungeRoom.x} y={L.y + L.h - 190} textAnchor="middle" fontFamily="Anton" fontSize="120" letterSpacing="10" fill="#F9B018">
            LOUNGE
          </text>
        )}
        {fo && (
          <motion.text style={{ opacity: loungeOpacity }} x={fo.x} y={L.y + L.h - 45} textAnchor="middle" fontFamily="Poppins" fontWeight="700" fontSize="48" fill="#F4E8E2" fillOpacity="0.85">
            ↓ Front Office · entrance
          </motion.text>
        )}

        {/* building-only: room labels, entrance, facilities */}
        <motion.g style={{ opacity: buildingOpacity }} pointerEvents={mode === 'building' ? 'auto' : 'none'}>
          {rooms
            .filter((r) => !r.batas)
            .map((r) => (
              <text key={r.label} x={r.x} y={r.y} textAnchor="middle" fontFamily="Poppins" fontWeight="800" fontSize={labelSize} fill="#F4E8E2" fillOpacity="0.85">
                {r.label}
              </text>
            ))}
          {fo?.pintu_masuk && (
            <g>
              <circle cx={fo.pintu_masuk.x} cy={fo.pintu_masuk.y} r={dotR * 1.6} fill="#E82020" opacity="0.3" />
              <circle cx={fo.pintu_masuk.x} cy={fo.pintu_masuk.y} r={dotR} fill="#E82020" />
              <text x={fo.pintu_masuk.x - dotR * 1.8} y={fo.pintu_masuk.y + labelSize * 1.1} textAnchor="end" fontFamily="Poppins" fontWeight="700" fontSize={labelSize * 0.9} fill="#F4E8E2">
                Entrance
              </text>
            </g>
          )}
          {facilities
            .filter((f) => f.x != null && f.y != null)
            .map((f) => (
              <g key={f.id} role="img" aria-label={f.label}>
                <circle cx={f.x!} cy={f.y!} r={iconR} fill="#F4E8E2" stroke="#0D2A4A" strokeWidth={iconR * 0.12} />
                <FacilityGlyph jenis={f.jenis} x={f.x!} y={f.y!} r={iconR} />
                <text x={f.x!} y={f.y! + iconR * 2.1} textAnchor="middle" fontFamily="Poppins" fontWeight="700" fontSize={labelSize * 0.85} fill="#F9B018">
                  {f.label}
                </text>
              </g>
            ))}
          {booths.map((b) => (
            <circle key={b.id} cx={b.x} cy={b.y} r={dotR} fill={DOT_FILL[status[b.id] ?? 'none']} stroke="#F4E8E2" strokeWidth={dotR * 0.25} />
          ))}
        </motion.g>

        {/* lounge-only: teardrop pins */}
        <motion.g style={{ opacity: loungeOpacity }} pointerEvents={mode === 'lounge' ? 'auto' : 'none'}>
          {booths.map((b, i) => {
            const st = status[b.id] ?? 'none'
            const label = pinLabel(b.nama, b.sort)
            return (
              <motion.g
                key={b.id}
                role="button"
                tabIndex={mode === 'lounge' ? 0 : -1}
                aria-label={`${b.nama} booth: ${st === 'none' ? 'not stamped yet' : st === 'stamped' ? 'stamped' : 'notes done'}`}
                style={{ cursor: 'pointer', originX: 0.5, originY: 1 }}
                onClick={() => onPin?.(b.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPin?.(b.id)}
                initial={dropPins && !reduce ? { y: -900, opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28, delay: dropPins ? 0.2 + i * 0.12 : 0 }}
                whileTap={{ scale: 1.15 }}
                whileHover={{ scale: 1.08 }}
              >
                <circle cx={b.x} cy={b.y - 30} r="115" fill="transparent" />
                <ellipse cx={b.x} cy={b.y + 92} rx="38" ry="10" fill="#000" opacity="0.35" />
                <path d={pinPath(b.x, b.y)} fill={PIN_FILL[st]} stroke="#F4E8E2" strokeWidth="8" />
                <text x={b.x} y={b.y - 32} textAnchor="middle" fontFamily="Anton" fontSize={label.length > 6 ? 34 : label.length > 1 ? 40 : 60} fill="#ffffff">
                  {label}
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
  const k = r / 12
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
