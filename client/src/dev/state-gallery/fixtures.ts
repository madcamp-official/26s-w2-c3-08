import {
  assetStudioScreenFixtures,
  type AssetStudioFixtureId,
} from '../../fixtures/asset-studio/assetStudioFixtures'
import {
  avatarStudioScreenFixtures,
  type AvatarStudioFixtureId,
} from '../../fixtures/avatar-studio/avatarStudioFixtures'
import {
  gameScreenFixtures,
  type GameScreenFixtureId,
} from '../../fixtures/game/gameFixtures'
import {
  loginScreenFixtures,
  type LoginScreenFixtureId,
} from '../../fixtures/login/loginFixtures'
import {
  lobbyScreenFixtures,
  type LobbyScreenFixtureId,
} from '../../fixtures/lobby/lobbyFixtures'
import {
  mainScreenFixtures,
  type MainScreenFixtureId,
} from '../../fixtures/main/mainFixtures'
import {
  roomScreenFixtures,
  type RoomScreenFixtureId,
} from '../../fixtures/room/roomFixtures'
import {
  warehouseScreenFixtures,
  type WarehouseScreenFixtureId,
} from '../../fixtures/warehouse/warehouseFixtures'

export type StateGalleryShell = 'launcher' | 'studio' | 'game'
export type StateGalleryViewport = '1280x720' | '1440x900' | '1920x1080'

export const stateGalleryViewports = ['1280x720', '1440x900', '1920x1080'] as const

export interface StateGalleryCase {
  id: string
  screenId: string
  shell: StateGalleryShell
  state: string
  viewport: StateGalleryViewport
  title: string
  description: string
  loginFixtureId?: LoginScreenFixtureId
  mainFixtureId?: MainScreenFixtureId
  lobbyFixtureId?: LobbyScreenFixtureId
  roomFixtureId?: RoomScreenFixtureId
  warehouseFixtureId?: WarehouseScreenFixtureId
  avatarStudioFixtureId?: AvatarStudioFixtureId
  assetStudioFixtureId?: AssetStudioFixtureId
  gameFixtureId?: GameScreenFixtureId
}

export const stateGalleryCases: StateGalleryCase[] = [
  ...loginScreenFixtures.map((fixture) => ({
    id: fixture.id,
    screenId: 'S1_LOGIN',
    shell: 'launcher' as const,
    state: fixture.state,
    viewport: fixture.viewport,
    title: fixture.title,
    description: fixture.description,
    loginFixtureId: fixture.id,
  })),
  ...mainScreenFixtures.map((fixture) => ({
    id: fixture.id,
    screenId: fixture.screenId,
    shell: 'launcher' as const,
    state: fixture.state,
    viewport: fixture.viewport,
    title: fixture.title,
    description: fixture.description,
    mainFixtureId: fixture.id,
  })),
  ...lobbyScreenFixtures.map((fixture) => ({
    id: fixture.id,
    screenId: fixture.screenId,
    shell: 'launcher' as const,
    state: fixture.state,
    viewport: fixture.viewport,
    title: fixture.title,
    description: fixture.description,
    lobbyFixtureId: fixture.id,
  })),
  ...roomScreenFixtures.map((fixture) => ({
    id: fixture.id,
    screenId: fixture.screenId,
    shell: 'launcher' as const,
    state: fixture.state,
    viewport: fixture.viewport,
    title: fixture.title,
    description: fixture.description,
    roomFixtureId: fixture.id,
  })),
  ...warehouseScreenFixtures.map((fixture) => ({
    id: fixture.id,
    screenId: fixture.screenId,
    shell: 'launcher' as const,
    state: fixture.state,
    viewport: fixture.viewport,
    title: fixture.title,
    description: fixture.description,
    warehouseFixtureId: fixture.id,
  })),
  ...avatarStudioScreenFixtures.map((fixture) => ({
    id: fixture.id,
    screenId: fixture.screenId,
    shell: 'studio' as const,
    state: fixture.state,
    viewport: fixture.viewport,
    title: fixture.title,
    description: fixture.description,
    avatarStudioFixtureId: fixture.id,
  })),
  ...assetStudioScreenFixtures.map((fixture) => ({
    id: fixture.id,
    screenId: fixture.screenId,
    shell: 'studio' as const,
    state: fixture.state,
    viewport: fixture.viewport,
    title: fixture.title,
    description: fixture.description,
    assetStudioFixtureId: fixture.id,
  })),
  ...gameScreenFixtures.map((fixture) => ({
    id: fixture.id,
    screenId: fixture.screenId,
    shell: 'game' as const,
    state: fixture.state,
    viewport: fixture.viewport,
    title: fixture.title,
    description: fixture.description,
    gameFixtureId: fixture.id,
  })),
]

export const launcherStateGalleryCases = stateGalleryCases.filter(
  (galleryCase) => galleryCase.shell === 'launcher',
)

export const launcherStateGalleryUrls = launcherStateGalleryCases.map((galleryCase) => ({
  id: galleryCase.id,
  screenId: galleryCase.screenId,
  state: galleryCase.state,
  url: `/ui-v2.html#/state-gallery?case=${encodeURIComponent(galleryCase.id)}`,
}))

export const launcherScreenshotMatrix = launcherStateGalleryCases.flatMap((galleryCase) =>
  stateGalleryViewports.map((viewport) => ({
    id: `${galleryCase.id}-${viewport}`,
    caseId: galleryCase.id,
    screenId: galleryCase.screenId,
    state: galleryCase.state,
    viewport,
    url: `/ui-v2.html#/state-gallery?case=${encodeURIComponent(galleryCase.id)}`,
  })),
)

export function getStateGalleryCase(caseId: string | undefined) {
  return (
    stateGalleryCases.find((galleryCase) => galleryCase.id === caseId) ?? stateGalleryCases[0]
  )
}
