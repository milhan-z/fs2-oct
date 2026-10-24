import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/poppins/800.css'
import '@fontsource/libre-baskerville/700.css'
import '@fontsource/libre-baskerville/400-italic.css'
import '@fontsource/anton/400.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import './styles/tokens.css'
import { App } from './app/App'

// open the connection to the backend while the app boots (TLS handshake off the critical path)
if (import.meta.env.VITE_DATA_MODE === 'supabase' && import.meta.env.VITE_SUPABASE_URL) {
  const l = document.createElement('link')
  l.rel = 'preconnect'
  l.href = new URL(import.meta.env.VITE_SUPABASE_URL).origin
  l.crossOrigin = 'anonymous'
  document.head.appendChild(l)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
