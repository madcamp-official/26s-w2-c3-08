import { expect, test, type Page } from '@playwright/test'

test('remote V2 browser flow reaches results through REST and Socket.IO phases', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await login(pageA, '원격호스트')
  await pageA.getByRole('button', { name: '게임하기' }).click()
  await expect(pageA.locator('[data-v2-component="lobby-screen"]')).toBeVisible()

  await pageA.getByLabel('방 이름').fill(`원격 테스트방 ${Date.now()}`)
  await pageA.getByRole('button', { name: '방 만들기' }).click()
  await expect(pageA.locator('[data-v2-component="room-screen"]')).toBeVisible()

  const roomId = getRoomIdFromUrl(pageA)

  await login(pageB, '원격게스트')
  await pageB.goto(`/ui-v2.html#/room?roomId=${encodeURIComponent(roomId)}`)
  await expect(pageB.locator('[data-v2-component="room-screen"]')).toBeVisible()
  await expect(playerSlot(pageB, '원격게스트').getByRole('heading', { name: '원격게스트' })).toBeVisible()

  await pageB.getByRole('button', { name: '준비' }).click()
  await expect(playerSlot(pageA, '원격게스트').getByRole('heading', { name: '원격게스트' })).toBeVisible()
  await expect(playerSlot(pageA, '원격게스트').getByText('준비됨')).toBeVisible()

  const startResponsePromise = pageA.waitForResponse((response) =>
    response.request().method() === 'POST' &&
    response.url().includes(`/api/rooms/${roomId}/start`),
  )
  const startButton = pageA.getByRole('button', { name: '제작 시작' })

  await expect(startButton).toBeEnabled()
  await startButton.click()

  const startResponse = await startResponsePromise
  const startBody = await startResponse.json() as { room?: { phase?: string } }

  expect(startResponse.status()).toBe(200)
  expect(startBody.room?.phase).toBe('building')
  await expect(pageA).toHaveURL(new RegExp(`#\\/map-build\\?roomId=${escapeRegExp(roomId)}`))
  await expect(pageA.locator('[data-v2-component="game-phase-controller"]')).toBeVisible()
  await expect(pageA.locator('[data-v2-screen="s4-map-build"]')).toBeVisible()
  await expect(pageB.locator('[data-v2-screen="s4-map-build"]')).toBeVisible()
  await expectMountedPhaserBridge(pageA, 'map-editor')
  await assertBridgeSurvivesResize(pageA, 'map-editor', { width: 1440, height: 900 })
  await assertGameRouteLeaveReturn(pageA, roomId, 'map-editor')

  await submitMapBuild(pageA, roomId)
  await submitMapBuild(pageB, roomId)
  await expect(pageA.locator('[data-v2-screen="d-validation"]')).toBeVisible()
  await expect(pageB.locator('[data-v2-screen="d-validation"]')).toBeVisible()
  await expectMountedPhaserBridge(pageA, 'playtest')
  await assertBridgeSurvivesResize(pageA, 'playtest', { width: 1920, height: 1080 })

  const mergeResponsePromise = waitForAnyPageResponse([pageA, pageB], (response) =>
    response.request().method() === 'POST' &&
    response.url().includes(`/api/rooms/${roomId}/merge`),
  )

  await recordValidationFailure(pageA, roomId)
  await recordValidationFailure(pageB, roomId)
  const mergeResponse = await mergeResponsePromise
  const mergeBody = await mergeResponse.json() as { mergedMap?: { id?: string }; room?: { phase?: string } }
  expect(mergeResponse.status()).toBe(200)
  expect(mergeBody.mergedMap?.id).toBeTruthy()
  expect(mergeBody.room?.phase).toBe('racing')
  await expect(pageA.locator('[data-v2-screen="e-race"]')).toBeVisible()
  await expect(pageB.locator('[data-v2-screen="e-race"]')).toBeVisible()
  await expectMountedPhaserBridge(pageA, 'race')
  await assertBridgeSurvivesResize(pageA, 'race', { width: 1280, height: 720 })

  await finishRace(pageA, roomId)
  await finishRace(pageB, roomId)
  await expect(pageA.locator('[data-v2-screen="f-results"]')).toBeVisible()
  await expect(pageB.locator('[data-v2-screen="f-results"]')).toBeVisible()
  await expect(pageA.locator('[data-v2-component="results-screen"]')).toBeVisible()

  await contextB.close()
  await contextA.close()
})

async function login(page: Page, nickname: string) {
  await page.goto('/ui-v2.html#/login')
  await expect(page.locator('[data-v2-component="login-screen"]')).toBeVisible()
  await expect(page.locator('[data-v2-component="login-controller"]')).toHaveAttribute('data-v2-data-mode', 'remote')
  await page.getByRole('textbox', { name: '닉네임' }).fill(nickname)
  await page.getByRole('button', { name: '시작하기' }).click()
  await expect(page.locator('[data-v2-component="main-screen"]')).toBeVisible()
  await expect(page.locator('[data-v2-component="main-controller"]')).toHaveAttribute('data-v2-data-mode', 'remote')
}

async function expectMountedPhaserBridge(
  page: Page,
  kind: 'map-editor' | 'playtest' | 'race',
) {
  const bridge = page.locator(
    `[data-v2-component="phaser-bridge"][data-v2-phaser-kind="${kind}"]`,
  )

  await expect(bridge).toHaveCount(1)
  await expect(bridge).toHaveAttribute('data-v2-state', 'mounted')
  await expect(bridge.locator('[data-v2-component="phaser-canvas-frame"]')).toBeVisible()
  await expect(bridge).not.toHaveAttribute('data-v2-state', 'duplicate-prevented')
}

async function assertBridgeSurvivesResize(
  page: Page,
  kind: 'map-editor' | 'playtest' | 'race',
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport)
  await expectMountedPhaserBridge(page, kind)

  const frame = page
    .locator(`[data-v2-component="phaser-bridge"][data-v2-phaser-kind="${kind}"]`)
    .locator('[data-v2-component="phaser-canvas-frame"]')
  const box = await frame.boundingBox()

  expect(box?.width ?? 0).toBeGreaterThan(320)
  expect(box?.height ?? 0).toBeGreaterThan(240)
}

async function assertGameRouteLeaveReturn(
  page: Page,
  roomId: string,
  kind: 'map-editor' | 'playtest' | 'race',
) {
  await page.getByRole('button', { name: '방 대기실' }).click()
  await expect(page).toHaveURL(new RegExp(`#\\/room\\?roomId=${escapeRegExp(roomId)}`))
  await expect(page.locator('[data-v2-component="room-screen"]')).toBeVisible()
  await expect(page.locator('[data-v2-component="phaser-bridge"]')).toHaveCount(0)

  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`#\\/map-build\\?roomId=${escapeRegExp(roomId)}`))
  await expect(page.locator('[data-v2-screen="s4-map-build"]')).toBeVisible()
  await expectMountedPhaserBridge(page, kind)
}

function playerSlot(page: Page, nickname: string) {
  return page.locator('[data-v2-component="player-slot"]').filter({ hasText: nickname })
}

function getRoomIdFromUrl(page: Page) {
  const roomId = new URL(page.url()).hash.match(/roomId=([^&]+)/)?.[1]

  expect(roomId).toBeTruthy()

  return decodeURIComponent(roomId ?? '')
}

async function submitMapBuild(page: Page, roomId: string) {
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' &&
    response.url().includes(`/api/rooms/${roomId}/segments`),
  )

  await page.getByRole('button', { name: '제작 완료' }).click()
  const response = await responsePromise

  expect(response.status()).toBe(201)
}

async function recordValidationFailure(page: Page, roomId: string) {
  const failureButton = page.getByRole('button', { name: '실패로 진행' })

  await expect(failureButton).toBeVisible()
  await expect(failureButton).toBeEnabled()

  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' &&
    response.url().includes(`/api/rooms/${roomId}/segments/validate`),
  )

  await failureButton.click()
  const response = await responsePromise

  expect(response.status()).toBe(200)
}

async function finishRace(page: Page, roomId: string) {
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' &&
    response.url().includes(`/api/rooms/${roomId}/race/finish`),
  )

  await page.getByRole('button', { name: '완주 기록' }).click()
  const response = await responsePromise

  expect(response.status()).toBe(200)
}

function waitForAnyPageResponse(
  pages: Page[],
  predicate: Parameters<Page['waitForResponse']>[0],
) {
  return Promise.race(pages.map((page) => page.waitForResponse(predicate)))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
