import { MotionConfig } from 'motion/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { lazy, Suspense } from 'react'
import { ContentProvider } from './providers'
import { ParticipantLayout, RequireParticipant } from './layouts'
import { DevPanel } from '../components/DevPanel'
import { Cover } from '../screens/participant/Cover'
import { Login } from '../screens/participant/Login'
import { Photo } from '../screens/participant/Photo'
import { Onboarding } from '../screens/participant/Onboarding'
import { MapScreen } from '../screens/participant/MapScreen'
import { QrScreen } from '../screens/participant/QrScreen'
import { StampMoment } from '../screens/participant/StampMoment'
import { Passport } from '../screens/participant/Passport'
import { Visa } from '../screens/participant/Visa'
import { Exit } from '../screens/participant/Exit'
import { Status } from '../screens/participant/Status'
import { Guide } from '../screens/participant/Guide'

const StaffHome = lazy(() => import('../screens/staff/StaffHome'))
const StaffBooth = lazy(() => import('../screens/staff/StaffBooth'))
const Admin = lazy(() => import('../screens/admin/Admin'))

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ContentProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-dvh bg-bg-0" />}>
            <Routes>
              <Route element={<ParticipantLayout />}>
                <Route path="/" element={<Cover />} />
                <Route path="/signin" element={<Login />} />
                <Route path="/guide" element={<Guide />} />
                <Route element={<RequireParticipant />}>
                  <Route path="/photo" element={<Photo />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/map" element={<MapScreen />} />
                  <Route path="/qr" element={<QrScreen />} />
                  <Route path="/stamp/:boothId" element={<StampMoment />} />
                  <Route path="/passport" element={<Passport />} />
                  <Route path="/visa/:boothId" element={<Visa />} />
                  <Route path="/exit" element={<Exit />} />
                  <Route path="/status" element={<Status />} />
                </Route>
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
