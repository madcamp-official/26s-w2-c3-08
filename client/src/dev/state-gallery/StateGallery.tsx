import { getPrototypeHref, setPrototypeRoute, type PrototypeRoute } from '../../app/navigation/prototypeRouter'
import { getAssetStudioScreenFixture, toAssetStudioScreenProps } from '../../fixtures/asset-studio/assetStudioFixtures'
import { getAvatarStudioScreenFixture, toAvatarStudioScreenProps } from '../../fixtures/avatar-studio/avatarStudioFixtures'
import { getGameScreenFixture } from '../../fixtures/game/gameFixtures'
import { getLoginScreenFixture, toLoginScreenProps } from '../../fixtures/login/loginFixtures'
import { getLobbyScreenFixture, toLobbyScreenProps } from '../../fixtures/lobby/lobbyFixtures'
import { getMainScreenFixture, toMainScreenProps } from '../../fixtures/main/mainFixtures'
import { getRoomScreenFixture, toRoomScreenProps } from '../../fixtures/room/roomFixtures'
import { getWarehouseScreenFixture, toWarehouseScreenProps } from '../../fixtures/warehouse/warehouseFixtures'
import { AssetStudioScreen } from '../../pages/asset-studio/AssetStudioScreen'
import { AvatarStudioScreen } from '../../pages/avatar-studio/AvatarStudioScreen'
import { GameFixturePreview } from '../../pages/game/GamePhaseController'
import { LoginScreen } from '../../pages/login/LoginScreen'
import { LobbyScreen } from '../../pages/lobby/LobbyScreen'
import { MainScreen } from '../../pages/main/MainScreen'
import { RoomScreen } from '../../pages/room/RoomScreen'
import { WarehouseScreen } from '../../pages/warehouse/WarehouseScreen'
import {
  getStateGalleryCase,
  launcherStateGalleryUrls,
  stateGalleryCases,
  type StateGalleryCase,
} from './fixtures'

interface StateGalleryProps {
  route: Extract<PrototypeRoute, { kind: 'stateGallery' }>
}

export default function StateGallery({ route }: StateGalleryProps) {
  const selectedCase = getStateGalleryCase(route.query.case)

  return (
    <section className="v2-panel" data-v2-component="state-gallery" data-v2-state={selectedCase.state}>
      <div className="v2-section-heading">
        <p className="v2-eyebrow">State Gallery</p>
        <h2>Fixture URL 재현</h2>
        <p>
          screenshot test가 같은 상태를 열 수 있도록 hash query의 <code>case</code> 값으로
          fixture를 고정합니다.
        </p>
      </div>

      <label className="v2-field">
        <span>화면별 fixture</span>
        <select
          value={selectedCase.id}
          onChange={(event) => setPrototypeRoute('state-gallery', { case: event.target.value })}
        >
          {stateGalleryCases.map((galleryCase) => (
            <option key={galleryCase.id} value={galleryCase.id}>
              {galleryCase.screenId} · {galleryCase.title}
            </option>
          ))}
        </select>
      </label>

      <div className="v2-preview-stage" data-v2-gallery-case={selectedCase.id}>
        {renderGalleryCase(selectedCase)}
      </div>

      <p className="v2-helper">
        Direct URL:{' '}
        <a href={getPrototypeHref('state-gallery', { case: selectedCase.id })}>
          /ui-v2.html{getPrototypeHref('state-gallery', { case: selectedCase.id })}
        </a>
      </p>

      <details className="v2-panel" data-v2-component="launcher-state-url-list">
        <summary>Launcher state URLs</summary>
        <div className="v2-launcher-url-list">
          {launcherStateGalleryUrls.map((item) => (
            <a key={item.id} href={item.url}>
              {item.screenId} · {item.state} · {item.url}
            </a>
          ))}
        </div>
      </details>
    </section>
  )
}

function renderGalleryCase(selectedCase: StateGalleryCase) {
  if (selectedCase.loginFixtureId) {
    const fixture = getLoginScreenFixture(selectedCase.loginFixtureId)

    return (
      <section
        className="v2-shell-viewport"
        data-viewport={selectedCase.viewport}
        aria-label={`${selectedCase.title} ${selectedCase.viewport}`}
      >
        <div className="v2-shell-viewport-meta">
          <span>{selectedCase.screenId}</span>
          <span>{selectedCase.state}</span>
        </div>
        <div className="v2-shell-fit">
          <LoginScreen
            {...toLoginScreenProps(fixture, {
              onNicknameChange: () => undefined,
              onSubmitNickname: () => undefined,
            })}
          />
        </div>
      </section>
    )
  }

  if (selectedCase.mainFixtureId) {
    const fixture = getMainScreenFixture(selectedCase.mainFixtureId)

    return (
      <section
        className="v2-shell-viewport"
        data-viewport={selectedCase.viewport}
        aria-label={`${selectedCase.title} ${selectedCase.viewport}`}
      >
        <div className="v2-shell-viewport-meta">
          <span>{selectedCase.screenId}</span>
          <span>{selectedCase.state}</span>
        </div>
        <div className="v2-shell-fit">
          <MainScreen {...toMainScreenProps(fixture)} />
        </div>
      </section>
    )
  }

  if (selectedCase.warehouseFixtureId) {
    const fixture = getWarehouseScreenFixture(selectedCase.warehouseFixtureId)

    return (
      <section
        className="v2-shell-viewport"
        data-viewport={selectedCase.viewport}
        aria-label={`${selectedCase.title} ${selectedCase.viewport}`}
      >
        <div className="v2-shell-viewport-meta">
          <span>{selectedCase.screenId}</span>
          <span>{selectedCase.state}</span>
        </div>
        <div className="v2-shell-fit">
          <WarehouseScreen {...toWarehouseScreenProps(fixture)} />
        </div>
      </section>
    )
  }

  if (selectedCase.lobbyFixtureId) {
    const fixture = getLobbyScreenFixture(selectedCase.lobbyFixtureId)

    return (
      <section
        className="v2-shell-viewport"
        data-viewport={selectedCase.viewport}
        aria-label={`${selectedCase.title} ${selectedCase.viewport}`}
      >
        <div className="v2-shell-viewport-meta">
          <span>{selectedCase.screenId}</span>
          <span>{selectedCase.state}</span>
        </div>
        <div className="v2-shell-fit">
          <LobbyScreen {...toLobbyScreenProps(fixture)} />
        </div>
      </section>
    )
  }

  if (selectedCase.roomFixtureId) {
    const fixture = getRoomScreenFixture(selectedCase.roomFixtureId)

    return (
      <section
        className="v2-shell-viewport"
        data-viewport={selectedCase.viewport}
        aria-label={`${selectedCase.title} ${selectedCase.viewport}`}
      >
        <div className="v2-shell-viewport-meta">
          <span>{selectedCase.screenId}</span>
          <span>{selectedCase.state}</span>
        </div>
        <div className="v2-shell-fit">
          <RoomScreen {...toRoomScreenProps(fixture)} />
        </div>
      </section>
    )
  }

  if (selectedCase.assetStudioFixtureId) {
    const fixture = getAssetStudioScreenFixture(selectedCase.assetStudioFixtureId)

    return (
      <section
        className="v2-shell-viewport"
        data-viewport={selectedCase.viewport}
        aria-label={`${selectedCase.title} ${selectedCase.viewport}`}
      >
        <div className="v2-shell-viewport-meta">
          <span>{selectedCase.screenId}</span>
          <span>{selectedCase.state}</span>
        </div>
        <div className="v2-shell-fit">
          <AssetStudioScreen {...toAssetStudioScreenProps(fixture)} />
        </div>
      </section>
    )
  }

  if (selectedCase.avatarStudioFixtureId) {
    const fixture = getAvatarStudioScreenFixture(selectedCase.avatarStudioFixtureId)

    return (
      <section
        className="v2-shell-viewport"
        data-viewport={selectedCase.viewport}
        aria-label={`${selectedCase.title} ${selectedCase.viewport}`}
      >
        <div className="v2-shell-viewport-meta">
          <span>{selectedCase.screenId}</span>
          <span>{selectedCase.state}</span>
        </div>
        <div className="v2-shell-fit">
          <AvatarStudioScreen {...toAvatarStudioScreenProps(fixture)} />
        </div>
      </section>
    )
  }

  if (selectedCase.gameFixtureId) {
    const fixture = getGameScreenFixture(selectedCase.gameFixtureId)

    return (
      <section
        className="v2-shell-viewport"
        data-viewport={selectedCase.viewport}
        aria-label={`${selectedCase.title} ${selectedCase.viewport}`}
      >
        <div className="v2-shell-viewport-meta">
          <span>{selectedCase.screenId}</span>
          <span>{selectedCase.state}</span>
        </div>
        <div className="v2-shell-fit">
          <GameFixturePreview fixture={fixture} />
        </div>
      </section>
    )
  }

  return (
    <article
      className={`v2-shell-preview is-${selectedCase.shell}`}
      data-v2-shell={selectedCase.shell}
      data-v2-screen={selectedCase.screenId.toLowerCase().replaceAll('_', '-')}
      data-v2-state={selectedCase.state}
    >
      <div>
        <p className="v2-eyebrow">{selectedCase.shell} shell</p>
        <h3>{selectedCase.title}</h3>
        <p>{selectedCase.description}</p>
      </div>
      <dl className="v2-meta-grid">
        <div>
          <dt>Screen ID</dt>
          <dd>{selectedCase.screenId}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{selectedCase.state}</dd>
        </div>
        <div>
          <dt>Viewport</dt>
          <dd>{selectedCase.viewport}</dd>
        </div>
      </dl>
    </article>
  )
}
