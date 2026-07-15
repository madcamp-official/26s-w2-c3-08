import { useEffect, useState, type ReactNode } from 'react'

import { Badge, Toast } from '../design-system/components'
import { Button, Text } from '../design-system/primitives'
import { GameShell, LauncherShell, StudioShell } from '../design-system/shells'
import StateGallery from '../dev/state-gallery/StateGallery'
import UiLab from '../dev/ui-lab/UiLab'
import { AssetStudioController } from '../pages/asset-studio/AssetStudioController'
import { AvatarStudioController } from '../pages/avatar-studio/AvatarStudioController'
import { GamePhaseController } from '../pages/game/GamePhaseController'
import { LoginController } from '../pages/login/LoginController'
import { LobbyController } from '../pages/lobby/LobbyController'
import { MainController } from '../pages/main/MainController'
import { RoomController } from '../pages/room/RoomController'
import { WarehouseController } from '../pages/warehouse/WarehouseController'
import {
  getPrototypeHref,
  parsePrototypeHash,
  prototypeNavItems,
  replaceEmptyHashWithDefault,
  type PrototypeRoute,
} from './navigation/prototypeRouter'
import './AppV2.css'

export interface AppV2Props {
  chrome?: 'product' | 'lab'
}

export default function AppV2({ chrome = 'lab' }: AppV2Props) {
  const [route, setRoute] = useState<PrototypeRoute>(() =>
    parsePrototypeHash(window.location.hash),
  )

  useEffect(() => {
    replaceEmptyHashWithDefault()

    const syncRoute = () => setRoute(parsePrototypeHash(window.location.hash))

    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)

    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  return (
    <div className={`v2-app is-${chrome}`} data-v2-route={route.path}>
      {chrome === 'lab' ? (
        <header className="v2-topbar">
          <div>
            <p className="v2-eyebrow">Frontend V2</p>
            <h1>Code-first UI Lab</h1>
          </div>
          <nav aria-label="V2 preview routes">
            {prototypeNavItems.map((item) => (
              <a
                key={item.path}
                href={getPrototypeHref(item.path, item.query)}
                aria-current={route.path === item.path ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>
      ) : null}

      <main className="v2-main">{renderRoute(route)}</main>
    </div>
  )
}

function renderRoute(route: PrototypeRoute) {
  switch (route.kind) {
    case 'uiLab':
      return <UiLab />
    case 'stateGallery':
      return <StateGallery route={route} />
    case 'shells':
      return <ShellsPreview />
    case 'login':
      return <LoginController />
    case 'main':
      return <MainController />
    case 'lobby':
      return <LobbyController />
    case 'room':
      return <RoomController roomId={route.contractRoute.roomId} />
    case 'mapBuild':
      return <GamePhaseController routeState={route.contractRoute} />
    case 'validation':
      return <GamePhaseController routeState={route.contractRoute} />
    case 'merging':
      return <GamePhaseController routeState={route.contractRoute} />
    case 'race':
      return <GamePhaseController routeState={route.contractRoute} />
    case 'results':
      return <GamePhaseController routeState={route.contractRoute} />
    case 'avatarStudio':
      return <AvatarStudioController routeState={route.contractRoute} />
    case 'assetStudio':
      return (
        <AssetStudioController routeState={route.contractRoute} />
      )
    case 'warehouse':
      return (
        <WarehouseController
          initialTab={route.contractRoute.tab}
          initialFilter={route.contractRoute.filter}
        />
      )
    case 'notFound':
      return <NotFound requestedPath={route.requestedPath} />
  }
}

function ShellsPreview() {
  return (
    <section className="v2-shell-showcase" data-v2-component="shell-preview-list">
      <ShellPreviewViewport label="LauncherShell">
        <LauncherShell
          title="Launcher Shell"
          subtitle="route preview"
          status={<Badge state="ready" />}
          primaryNav={<Button size="small" variant="secondary">Nav</Button>}
          toastLayer={<Toast title="Toast layer" message="route preview" />}
        >
          <div className="v2-launcher-placeholder">
            <span className="v2-shell-block is-large" />
            <div className="v2-shell-action-stack">
              <Button>Primary CTA</Button>
              <Button variant="secondary">Secondary CTA</Button>
            </div>
          </div>
        </LauncherShell>
      </ShellPreviewViewport>
      <ShellPreviewViewport label="StudioShell">
        <StudioShell
          title="Studio Shell"
          leftPanel={<PreviewPanel title="Left panel" />}
          center={<PreviewCanvas label="Workspace" />}
          rightPanel={<PreviewPanel title="Right panel" />}
          topBar={<Button size="small">Action</Button>}
          statusLayer={<Badge state="ready" label="expanded" />}
        />
      </ShellPreviewViewport>
      <ShellPreviewViewport label="GameShell">
        <GameShell
          title="Game Shell"
          topHud={<Badge state="ready" label="HUD" />}
          leftShelf={<PreviewPanel title="Shelf" inverse />}
          canvas={<PreviewCanvas label="Canvas Slot" inverse />}
          rightToolDock={<PreviewPanel title="Dock" inverse />}
          bottomOverlay={<span>status overlay</span>}
          statusOverlay={<Badge state="ready" label="Canvas priority" />}
        />
      </ShellPreviewViewport>
    </section>
  )
}

function ShellPreviewViewport({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="v2-shell-viewport" data-viewport="1280x720" aria-label={`${label} 1280x720`}>
      <div className="v2-shell-viewport-meta">
        <Text variant="caption" tone="secondary" weight="bold">
          {label}
        </Text>
        <Text variant="caption" tone="secondary">
          1280x720
        </Text>
      </div>
      <div className="v2-shell-fit">{children}</div>
    </section>
  )
}

function PreviewPanel({ title, inverse = false }: { title: string; inverse?: boolean }) {
  return (
    <div className="v2-shell-panel-stack">
      <Text tone={inverse ? 'inverse' : 'primary'} weight="bold">
        {title}
      </Text>
      <span className="v2-shell-block" />
      <span className="v2-shell-block" />
      <span className="v2-shell-block" />
    </div>
  )
}

function PreviewCanvas({ label, inverse = false }: { label: string; inverse?: boolean }) {
  return (
    <div className={inverse ? 'v2-game-canvas-placeholder' : 'v2-studio-workspace-placeholder'}>
      <span className="v2-shell-block is-large" />
      <Text tone={inverse ? 'inverse' : 'secondary'} weight="bold">
        {label}
      </Text>
    </div>
  )
}

function NotFound({ requestedPath }: { requestedPath: string }) {
  return (
    <section className="v2-panel" data-v2-component="not-found" data-v2-state="error">
      <p className="v2-eyebrow">V2 NotFound</p>
      <h2>알 수 없는 V2 route입니다</h2>
      <p>
        요청한 hash route <code>{requestedPath}</code>는 prototype router에 등록되어 있지 않습니다.
      </p>
      <a className="v2-action-link" href={getPrototypeHref('ui-lab')}>
        UI Lab으로 이동
      </a>
    </section>
  )
}
