import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import AppV2 from './app/AppV2'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppV2 chrome="lab" />
  </StrictMode>,
)
