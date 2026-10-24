import { AnimatePresence, motion } from 'motion/react'
import { Navigate, useLocation } from 'react-router'
import { api } from '../data/api'
import { ParticipantProvider } from './participant'
import { Booklet } from '../booklet/Booklet'
import { lazy, Suspense } from 'react'

const Onboarding = lazy(() => import('../screens/participant/Onboarding').then((m) => ({ default: m.Onboarding })))

/**
 * Participant shell: the Night stage with one passport (Booklet) on it. Onboarding is the only
 * full-screen Night moment — the book slides down out of view and comes back up afterwards.
 */
export function ParticipantLayout() {
  const loc = useLocation()
  const onboarding = loc.pathname === '/onboarding'
  return (
    <ParticipantProvider>
      <div className="mat-night fixed inset-0 overflow-hidden">
        {/* the single red light source: a glow leaking from a crack below */}
        <div className="pointer-events-none absolute -bottom-28 left-1/2 h-56 w-[130%] -translate-x-1/2 rounded-[50%] bg-[#8f1d17] opacity-25 blur-3xl" aria-hidden="true" />
        <AnimatePresence initial={false}>
          {onboarding ? (
            <motion.div key="onboarding" className="absolute inset-0 mx-auto max-w-[430px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <Suspense fallback={null}>{api.hasSession() ? <Onboarding /> : <Navigate to="/signin" replace />}</Suspense>
            </motion.div>
          ) : (
            <motion.div key="book" className="absolute inset-0" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
              <Booklet />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ParticipantProvider>
  )
}
