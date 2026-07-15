import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppShell } from './ui/AppShell.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)

// 개발자 콘솔(` 토글) — 정적 가드가 false인 프로덕션 빌드에서는 코드째 제외됨
if (import.meta.env.DEV || import.meta.env.VITE_DEV_CONSOLE === '1') {
  import('./devconsole/mount.tsx').then((m) => m.mountDevConsole())
}
