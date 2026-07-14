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

  await submitMapBuild(pageA, roomId)
  await submitMapBuild(pageB, roomId)
  await expect(pageA.locator('[data-v2-screen="d-validation"]')).toBeVisible()
  await expect(pageB.locator('[data-v2-screen="d-validation"]')).toBeVisible()

  const mergeResponsePromise = pageA.waitForResponse((response) =>
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
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' &&
    response.url().includes(`/api/rooms/${roomId}/segments/validate`),
  )

  await page.getByRole('button', { name: '실패로 진행' }).click()
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
