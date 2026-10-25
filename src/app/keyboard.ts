import { useEffect } from 'react'

const FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]), textarea, select'
const isField = (el: EventTarget | Element | null): el is HTMLElement => el instanceof HTMLElement && el.matches(FIELD)

/**
 * Phone-keyboard manners for every form in the app:
 *  - `--kb` (px) on <html> is the height the on-screen keyboard covers, so scrolling pages can leave room under
 *    their content (`padding-bottom: var(--kb)`) and the focused field can always be lifted above the keyboard;
 *  - the focused field is scrolled into the middle of the visible area once the keyboard has opened;
 *  - dragging the page downwards with a finger puts the keyboard away (interactive dismiss).
 */
export function useKeyboardAvoid() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let timer = 0
    let kb = 0

    const reveal = (el: HTMLElement) => el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })

    const update = () => {
      kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
      root.style.setProperty('--kb', `${Math.round(kb)}px`)
    }
    const onResize = () => {
      update()
      const a = document.activeElement
      if (kb > 80 && isField(a)) {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => reveal(a), 60)
      }
    }
    const onFocusIn = (e: FocusEvent) => {
      if (!isField(e.target)) return
      const el = e.target
      window.clearTimeout(timer)
      timer = window.setTimeout(() => reveal(el), 320) // after the keyboard's slide-up
    }

    let startY = 0
    let startedOnField = false
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
      startedOnField = isField(e.target)
    }
    const onTouchMove = (e: TouchEvent) => {
      const a = document.activeElement
      if (startedOnField || !isField(a) || kb < 80) return
      if (e.touches[0].clientY - startY > 56) {
        a.blur()
        startedOnField = true // once per gesture
      }
    }

    update()
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', update)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      window.clearTimeout(timer)
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', update)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      root.style.removeProperty('--kb')
    }
  }, [])
}
