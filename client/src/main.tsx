import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppV2 from './app/AppV2'
import AppErrorBoundary from './components/AppErrorBoundary'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppV2 chrome="product" />
    </AppErrorBoundary>
  </StrictMode>,
)
