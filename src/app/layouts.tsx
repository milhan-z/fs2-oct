import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Navigate, NavLink, useLocation, useOutlet } from 'react-router'
import { api } from '../data/api'
import { ParticipantProvider, useParticipant } from './participant'
import { screenVariants } from '../motion/presets'
import { Icon } from '../components/decor'

const NAV_ROUTES = ['/map', '/passport']

/** Keeps the outgoing route rendered while it animates out. */
function FrozenOutlet() {
  const outlet = useOutlet()
  const [frozen] = useState(outlet)
  return frozen
}

export function ParticipantLayout() {
  const loc = useLocation()
  const showNav = NAV_ROUTES.includes(loc.pathname)
  // screens that run their own full-screen choreography skip the generic slide
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  // cover → sign-in share the passport page (layoutId), so neither route fades as a whole
  const shared = loc.pathname === '/' || loc.pathname === '/signin'
  const plain = shared || loc.pathname.startsWith('/stamp') || loc.pathname === '/onboarding'
  return (
    <ParticipantProvider>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-clip bg-bg-0">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={loc.pathname}
            className="flex min-h-dvh flex-1 flex-col"
            variants={plain ? undefined : screenVariants}
            initial={shared ? false : plain ? { opacity: 0 } : 'initial'}
            animate={plain ? { opacity: 1 } : 'animate'}
            exit={shared ? { opacity: 0, transition: { delay: 0.3, duration: 0.2 } } : plain ? { opacity: 0 } : 'exit'}
            style={{ paddingBottom: showNav ? 84 : 0 }}
          >
            <FrozenOutlet />
          </motion.div>
        </AnimatePresence>
        {showNav && <BottomNav />}
      </div>
    </ParticipantProvider>
  )
}

/** Guards: needs a session, and the attendance photo before anything else. */
export function RequireParticipant() {
  const loc = useLocation()
  const outlet = useOutlet()
  const { state } = useParticipant()
  if (!api.hasSession()) return <Navigate to="/signin" replace />
  if (state && !state.participant.photo && loc.pathname !== '/photo') return <Navigate to="/photo" replace />
  return outlet
}

function BottomNav() {
  const item = 'flex min-h-12 w-[72px] flex-col items-center gap-[3px] text-[12px]'
  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-1/2 z-30 flex h-[84px] w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-[#3a1a1c] bg-bg-0 px-6 pb-[env(safe-area-inset-bottom)]">
      <NavLink to="/map" className={({ isActive }) => `${item} ${isActive ? 'font-extrabold text-yellow' : 'text-muted'}`}>
        <Icon.Map className="h-[22px] w-[22px]" />
        Map
      </NavLink>
      <NavLink
        to="/qr"
        aria-label="Show QR"
        className="-mt-9 flex h-[68px] w-[68px] flex-col items-center justify-center rounded-full border-4 border-bg-0 bg-red text-[11px] font-extrabold text-white shadow-[0_0_22px_rgba(210,43,38,0.55)]"
      >
        <Icon.Qr className="h-6 w-6" />
        QR
      </NavLink>
      <NavLink to="/passport" className={({ isActive }) => `${item} ${isActive ? 'font-extrabold text-yellow' : 'text-muted'}`}>
        <Icon.Passport className="h-[22px] w-[22px]" />
        Passport
      </NavLink>
    </nav>
  )
}
