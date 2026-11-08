import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { seedCrazyWeek } from './dev/seedCrazyWeek'

// DEV-ONLY: open the app with ?seed=crazy-week to load a busy demo week
// (see dev/seedCrazyWeek.ts). Runs before the app reads its saved data, then
// drops the flag from the address so a refresh doesn't run it again.
// import.meta.env.DEV is false in production builds, so this never ships.
if (import.meta.env.DEV) {
  const url = new URL(window.location.href)
  if (url.searchParams.get('seed') === 'crazy-week') {
    seedCrazyWeek()
    url.searchParams.delete('seed')
    window.history.replaceState(null, '', url)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
