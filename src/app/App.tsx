import { MotionConfig } from 'motion/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { lazy, Suspense } from 'react'
import { ContentProvider } from './providers'
import { ParticipantLayout } from './layouts'
import { DevPanel } from '../components/DevPanel'
import { useKeyboardAvoid } from './keyboard'

const StaffHome = lazy(() => import('../screens/staff/StaffHome'))
const StaffBooth = lazy(() => import('../screens/staff/StaffBooth'))
const Admin = lazy(() => import('../screens/admin/Admin'))

// Participant routes are pages of one Booklet (src/booklet): the layout renders the book, which
// picks the page from the URL. The routes are listed so unknown paths still fall back to "/".
const PARTICIPANT_PATHS = ['/', '/signin', '/guide', '/photo', '/onboarding', '/map', '/qr', '/stamp/:boothId', '/passport', '/visa/:boothId', '/exit', '/status']

export function App() {
  useKeyboardAvoid()
  return (
    <MotionConfig reducedMotion="user">
      <ContentProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-dvh bg-night-0" />}>
            <Routes>
              <Route element={<ParticipantLayout />}>
                {PARTICIPANT_PATHS.map((p) => (
                  <Route key={p} path={p} element={null} />
                ))}
              </Route>
              <Route path="/staff" element={<StaffHome />} />
              <Route path="/staff/:slug" element={<StaffBooth />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <DevPanel />
        </BrowserRouter>
      </ContentProvider>
    </MotionConfig>
  )
}
