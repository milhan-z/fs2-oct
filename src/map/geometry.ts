import wallsRaw from './walls.svg?raw'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Full plan in assets/map/global-kampong-walls.svg coordinates */
export const PLAN: Rect = { x: 0, y: 0, w: 1834, h: 4945 }
/** Base viewBox = Lounge camera (matches reference mockup Peta) */
export const CAM_LOUNGE: Rect = { x: 470, y: 2660, w: 1350, h: 1838 }
export const CAM_BUILDING: Rect = { x: -60, y: -60, w: 1954, h: 5065 }
export const LOUNGE_BOUNDS: Rect = { x: 748, y: 2734, w: 634, h: 1694 }

export const viewBoxOf = (r: Rect) => `${r.x} ${r.y} ${r.w} ${r.h}`

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t }
}

/** Transform that makes `target` fill the base viewBox `base` (meet). */
export function cameraTransform(base: Rect, target: Rect): { s: number; tx: number; ty: number; str: string } {
  const s = Math.min(base.w / target.w, base.h / target.h)
  const tx = base.x + base.w / 2 - s * (target.x + target.w / 2)
  const ty = base.y + base.h / 2 - s * (target.y + target.h / 2)
  return { s, tx, ty, str: `translate(${tx} ${ty}) scale(${s})` }
}

/** Wall markup, recoloured to inherit `currentColor` (cream on the red panel). */
export const WALLS_INNER = wallsRaw
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '')
  .replace(/stroke="black"/g, 'stroke="currentColor"')
  .replace(/fill="black"/g, 'fill="currentColor"')
  .replace(/fill="#FFE797" fill-opacity="0.22"/g, 'fill="currentColor" fill-opacity="0.05"')
  .replace(/<(rect|path) /g, '<$1 pathLength="1" ')

export const pinPath = (x: number, y: number) =>
  `M${x} ${y + 90} c-52 -68 -75 -98 -75 -135 a75 75 0 0 1 150 0 c0 37 -23 67 -75 135z`
