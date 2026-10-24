import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from './decor'

export function BackHeader({ kicker, to, onBack, right }: { kicker: string; to?: string; onBack?: () => void; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="flex items-center gap-2 px-3 pt-4">
      <button
        type="button"
        aria-label="Back"
        onClick={() => (onBack ? onBack() : to ? nav(to) : nav(-1))}
        className="flex h-11 w-11 items-center justify-center rounded-full text-cream hover:bg-white/5"
      >
        <Icon.Back className="h-6 w-6" />
      </button>
      <div className="kicker flex-1">{kicker}</div>
      {right}
    </div>
  )
}

export function ErrorText({ children, onPaper = false }: { children: ReactNode; onPaper?: boolean }) {
  return (
    <AnimatePresence>
      {children ? (
        <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`text-[14px] font-semibold ${onPaper ? 'text-[#b3261e]' : 'text-[#ff8a80]'}`}>
          {children}
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}

/** Small transient message at the bottom of the screen. */
export function Toast({ message, onDone, tone = 'ok' }: { message: string | null; onDone: () => void; tone?: 'ok' | 'warn' }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [message, onDone])
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-[15px] font-bold whitespace-nowrap shadow-xl ${tone === 'ok' ? 'bg-[#1f7a4a] text-white' : 'bg-yellow text-navy'}`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden="true" />
}

export function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-muted" role="status">
      <Spinner />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
