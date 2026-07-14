import { expect, test } from '@playwright/test'

const sessionA = {
  id: 'context-a',
  nickname: '브라우저A',
  token: 'token-a',
  avatarAssetId: null,
}

const sessionB = {
  id: 'context-b',
  nickname: '브라우저B',
  token: 'token-b',
  avatarAssetId: null,
}

test('two local realtime pages create, join, sync ready, leave, reconnect, and block disabled rooms', async ({ browser }) => {
  const context = await browser.newContext()
  const pageA = await context.newPage()
  const pageB = await context.newPage()

  await seedPageSession(pageA, sessionA, { resetRooms: true })
  await pageA.goto('/ui-v2.html#/lobby')
  await expect(pageA.getByText('로비')).toBeVisible()
  await expect(pageA.getByText('정원이 찼어요.')).toBeVisible()
  await expect(
    pageA
      .locator('[data-v2-id="mock-room-playing"]')
      .getByRole('definition')
      .filter({ hasText: /게임 중/ }),
  ).toBeVisible()
  await expect(pageA.locator('[data-v2-id="mock-room-full"]').getByRole('button')).toBeDisabled()
  await expect(pageA.locator('[data-v2-id="mock-room-playing"]').getByRole('button')).toBeDisabled()

  await pageA.getByLabel('방 이름').fill('두 context 테스트방')
  await pageA.getByRole('button', { name: '방 만들기' }).click()
  await expect(pageA.locator('[data-v2-component="room-screen"]')).toBeVisible()

  const roomId = new URL(pageA.url()).hash.match(/roomId=([^&]+)/)?.[1]
  expect(roomId).toBeTruthy()

  await seedPageSession(pageB, sessionB)
  await pageB.goto(`/ui-v2.html#/room?roomId=${roomId}`)
  await expect(pageB.locator('[data-v2-component="room-screen"]')).toBeVisible()
  await expect(playerSlot(pageB, '브라우저B').getByRole('heading', { name: '브라우저B' })).toBeVisible()

  await pageB.getByRole('button', { name: '준비' }).click()
  await expect(playerSlot(pageA, '브라우저B').getByRole('heading', { name: '브라우저B' })).toBeVisible()
  await expect(playerSlot(pageA, '브라우저B').getByText('준비됨')).toBeVisible()

  await pageB.getByRole('button', { name: '로비로 나가기' }).click()
  await expect(pageB).toHaveURL(/#\/lobby/)
  await expect(pageA.getByText('참가자가 나갔어요.')).toBeVisible()

  await pageA.goto('/ui-v2.html#/state-gallery?case=c-room-reconnecting')
  await expect(pageA.locator('[data-v2-component="room-screen"][data-v2-state="reconnecting"]')).toBeVisible()

  await context.close()
})

function playerSlot(page, nickname) {
  return page.locator('[data-v2-component="player-slot"]').filter({ hasText: nickname })
}

async function seedPageSession(page, session, { resetRooms = false } = {}) {
  await page.addInitScript(({ nextSession, shouldResetRooms }) => {
    window.localStorage.setItem('relay.session', JSON.stringify(nextSession))

    if (shouldResetRooms) {
      window.localStorage.removeItem('relay.mock.rooms')
      window.localStorage.removeItem('relay.v2.local.room-snapshots')
    }
  }, { nextSession: session, shouldResetRooms: resetRooms })
}
