// Route ↔ page model. Sign-in and photo are pages of the physical passport (book mode); once the
// passport is issued, Map · Passport · Status · Guide fill the whole screen (app mode). The QR
// permit, a visa and the exit form are overlays that grow from what opened them.

export type PageKey = 'signin' | 'photo' | 'map' | 'passport' | 'status' | 'guide'
export type Overlay = { kind: 'qr' } | { kind: 'visa'; boothId: string; stamp: boolean } | { kind: 'exit' } | null

export interface PageInfo {
  /** page from the URL; null when the URL is an overlay (the page underneath stays) */
  key: PageKey | null
  index: number
  /** the cover is closed on this route */
  cover: boolean
  overlay: Overlay
}

const INDEX: Record<PageKey, number> = { signin: 1, photo: 2, map: 3, passport: 4, status: 5, guide: 6 }

export function pageFor(pathname: string): PageInfo {
  const p = pathname.replace(/\/+$/, '') || '/'
  const visa = p.match(/^\/(visa|stamp)\/([^/]+)$/)
  if (visa) return { key: null, index: -1, cover: false, overlay: { kind: 'visa', boothId: visa[2], stamp: visa[1] === 'stamp' } }
  if (p === '/qr') return { key: null, index: -1, cover: false, overlay: { kind: 'qr' } }
  if (p === '/exit') return { key: null, index: -1, cover: false, overlay: { kind: 'exit' } }
  const key = (
    {
      '/': 'signin',
      '/signin': 'signin',
      '/photo': 'photo',
      '/map': 'map',
      '/passport': 'passport',
      '/status': 'status',
      '/guide': 'guide',
    } as Record<string, PageKey>
  )[p] ?? 'map'
  return { key, index: INDEX[key], cover: p === '/', overlay: null }
}

export const pageIndex = (k: PageKey) => INDEX[k]

/** Pages reachable without a session. */
export const PUBLIC_KEYS: PageKey[] = ['signin', 'guide']

/** Book mode = the physical passport on the night table (cover, sign-in, photo). */
export function isBookPage(key: PageKey, issued: boolean): boolean {
  if (key === 'signin' || key === 'photo') return true
  if (key === 'guide') return !issued
  return false
}

export function pathOf(key: PageKey): string {
  return key === 'signin' ? '/signin' : `/${key}`
}

// --- grow-from-origin: remembers the screen rect of the element that opened an overlay --------
let originRect: DOMRect | null = null
export function setOrigin(el: Element | null) {
  originRect = el ? el.getBoundingClientRect() : null
}
export function takeOrigin(): DOMRect | null {
  return originRect
}
