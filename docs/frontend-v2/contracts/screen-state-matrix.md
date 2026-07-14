# Frontend V2 Screen State Matrix

작성일: 2026-07-13  
목적: V2 화면별 state, controller callback, service dependency, Figma readiness를 잠근다.

## 1. Status Legend

| 값 | 의미 |
|---|---|
| `APPROVED_SPEC` | 제품 사양이 확정되어 Figma frame 제작 가능 |
| `CONTRACT_FIRST` | 현재 MVP 동작 기반 계약 우선, 이후 Figma frame 제작 |
| `LEGACY_REFERENCE_ONLY` | 현재 UI는 동작 참고만 하고 모양/JSX/CSS는 재사용하지 않음 |

## 2. S1 Login

| Field | Contract |
|---|---|
| screen ID | `S1_LOGIN` |
| entry condition | stored session 없음, 또는 session restore 실패 |
| exit condition | `session.login(nickname)` 성공 후 `S2_MAIN` |
| visible data | nickname input, submit state, validation message |
| user actions | nickname 입력, Enter submit, 시작하기 |
| controller callbacks | `login(nickname)`, `restoreSession()` |
| loading | boot/session validation, submit pending |
| empty | nickname empty disables submit and shows validation |
| success | route becomes `S2_MAIN`; session persisted |
| error | validation/authentication/server unavailable/malformed response |
| offline | `VITE_DATA_MODE=remote`이면 offline error; `mock`이면 mock session 가능 |
| reconnecting | not applicable |
| permission/disabled | nickname 1-12자 아닐 때 submit disabled |
| localStorage | reads/writes `relay.session` or profile-scoped session via API adapter |
| API | `createSession`; remote session restore validates through `/api/session/validate` |
| realtime | on success controller connects realtime according to `VITE_REALTIME_MODE` |
| keyboard | Enter submit; Tab order input -> submit |
| responsive rules | launcher shell, 720p height에서 form과 CTA가 접히지 않아야 함 |
| accessibility | input label, error text linked to input, focus visible |
| Figma frame status | `APPROVED_SPEC`; create as launcher frame |

## 3. S2 Main

| Field | Contract |
|---|---|
| screen ID | `S2_MAIN` |
| entry condition | valid session exists; avatar submit success; room leave from results/lobby returns to lobby not main |
| exit condition | game CTA -> `S3_LOBBY`; asset CTA -> `B_ASSET_STUDIO`; avatar panel -> `S2B_WAREHOUSE`; settings -> overlay |
| visible data | equipped/default avatar, avatar generating summary, primary CTAs, asset/job summary |
| user actions | 게임하기, 에셋 만들기, 내 창고, avatar panel click, settings open, logout if present |
| controller callbacks | `navigateLobby()`, `openAssetStudio()`, `openWarehouse(tab)`, `openSettings()` |
| loading | initial assets/rooms refresh |
| empty | no user avatar shows system `졸라맨` |
| success | avatar generating/ready/failed states visible |
| error | asset load error, session expired, server unavailable |
| offline | remote mode shows offline badge and disables remote-only refresh; mock mode normal |
| reconnecting | realtime status badge only |
| permission/disabled | no hard block for no avatar; game can start with default avatar |
| localStorage | session, settings read indirectly |
| API | `listAssets`, `listRooms` during boot/refresh |
| realtime | asset job push updates through store; rooms changed optional |
| keyboard | CTA buttons reachable; settings icon has label |
| responsive rules | launcher shell; at 1280x720 no overlap between avatar panel and CTAs |
| accessibility | icon button accessible name; status not color-only |
| Figma frame status | `APPROVED_SPEC`; create as launcher frame |

## 4. S2b Warehouse

| Field | Contract |
|---|---|
| screen ID | `S2B_WAREHOUSE` |
| entry condition | from main CTA, avatar panel, or asset studio toast CTA |
| exit condition | back/main nav, edit asset -> `A_AVATAR_STUDIO` or `B_ASSET_STUDIO`, create new asset |
| visible data | avatar/component tabs, category filters, asset cards, status overlays, detail modal |
| user actions | tab/filter, asset open, equip avatar, retry failed sprite, edit/remix, close modal |
| controller callbacks | `openWarehouse(tab)`, `equipAvatar(assetId)`, `requestSpriteRegeneration(assetId, action)`, `openStudioWithAsset(assetId, category)` |
| loading | assets refresh, retry request |
| empty | no assets in selected tab/filter |
| success | ready thumbnail, equipped avatar marker, retry queued |
| error | asset job failure, retry cooldown, malformed asset |
| offline | remote refresh disabled/error; cached/mock assets still visible in mock mode |
| reconnecting | asset job status may be stale; show reconnecting badge |
| permission/disabled | working assets unusable; cooldown disables regen; item hidden from user-created component filter |
| localStorage | mock assets in `relay.mock.assets`; session avatar persisted |
| API | `listAssets`, `requestSpriteRegeneration` via `/api/assets/:assetId/sprites/:action/regenerate` |
| realtime | `AssetJobUpdates.assetJobUpdated` |
| keyboard | tabs arrow/Tab navigable; modal ESC close |
| responsive rules | grid reflows; cards keep stable dimensions |
| accessibility | modal focus trap, action tabs labelled, status text exposed |
| Figma frame status | `APPROVED_SPEC`; include empty/loading/error/card states |

## 5. S2c Settings Modal

| Field | Contract |
|---|---|
| screen ID | `S2C_SETTINGS_MODAL` |
| entry condition | settings icon from launcher shell |
| exit condition | close/ESC/backdrop; device code consume success returns to main state |
| visible data | sound controls, nickname field, device link code issue/consume |
| user actions | volume, mute, nickname save, issue code, consume code, close |
| controller callbacks | `updateSettings(partial)`, `updateNickname(nickname)`, `issueDeviceLinkCode()`, `loadSessionByDeviceCode(code)` |
| loading | device link issue/consume pending |
| empty | no issued code, empty import code |
| success | settings saved, code displayed, session loaded |
| error | invalid/expired code, session not found, server unavailable |
| offline | sound/nickname local update allowed; remote device link disabled in remote mode if offline |
| reconnecting | realtime status informational only |
| permission/disabled | invalid nickname/code disables submit |
| localStorage | `relay.settings`, session keys |
| API | `createDeviceLinkCode`, `consumeDeviceLinkCode`, `updateNickname` via `/api/session/nickname` |
| realtime | nickname update may notify lobby presence if in room |
| keyboard | ESC closes; sliders keyboard operable |
| responsive rules | modal fits 720p height with internal scroll |
| accessibility | focus trap, labelled sliders/toggles, code text selectable |
| Figma frame status | `APPROVED_SPEC`; modal component |

## 6. A Avatar Studio

| Field | Contract |
|---|---|
| screen ID | `A_AVATAR_STUDIO` |
| entry condition | from top nav, warehouse avatar edit/remix, or create avatar CTA |
| exit condition | submit success -> `S2_MAIN`; manual main/back; load avatar stays in screen |
| visible data | 256x512 visible canvas, tools, palette, checker/grid overlay, my avatar list, optional description |
| user actions | draw, erase, eyedropper, move all, undo/redo, clear, checker toggle, load/equip avatar, submit |
| controller callbacks | `submitAvatar(payload)`, `equipAvatar(assetId)`, `loadAssetSource(assetId)`, `markDirty()` |
| loading | submit pending, avatar list refresh |
| empty | blank canvas, no my avatars |
| success | submit creates job and navigates main |
| error | validation, asset job request failure, drawing export failure |
| offline | remote mode submit fails with typed offline/server error; mock mode creates mock job |
| reconnecting | asset job push not required before leaving; main shows status later |
| permission/disabled | loaded unchanged asset cannot submit; image paste/drop blocked |
| localStorage | `relay.studioLayout`; no image upload storage |
| API | `createAsset` with `category='avatar'` |
| realtime | asset job push after submit |
| keyboard | drawing shortcuts `TBD-CONTRACT`; buttons accessible without shortcuts |
| responsive rules | studio shell; canvas remains inspectable and panels scroll/collapse |
| accessibility | tool buttons have labels/tooltips; color controls name selected color |
| Figma frame status | `APPROVED_SPEC`; include loaded unchanged/submitting/error states |

## 7. B Asset Studio

| Field | Contract |
|---|---|
| screen ID | `B_ASSET_STUDIO` |
| entry condition | main asset CTA, warehouse component edit/remix, toast new asset CTA |
| exit condition | manual nav; successful non-avatar submit stays on screen; warehouse CTA opens S2b component tab |
| visible data | n x m canvas, tools/palette/load modal, category, size, attribute form, description/name, toast |
| user actions | category/size/attrs, draw, load mine/others, submit, new asset reset, warehouse CTA |
| controller callbacks | `submitComponentAsset(payload)`, `openWarehouse('component')`, `loadAssetSource(assetId)`, `resetStudio()` |
| loading | submit pending, load modal refresh |
| empty | blank canvas, no loadable assets |
| success | success toast, job visible via warehouse CTA, form/canvas preserved |
| error | missing name, invalid attrs, export failure, request failure |
| offline | remote mode submit fails; mock mode creates mock asset job |
| reconnecting | job status may wait for push/polling |
| permission/disabled | loaded unchanged asset cannot submit; item/avatar not selectable as user-created category |
| localStorage | `relay.studioLayout`; mock assets |
| API | `createAsset` with category `platform|obstacle|monster|background` |
| realtime | `AssetJobUpdates.assetJobUpdated` after job created |
| keyboard | form controls native; modal ESC close |
| responsive rules | studio panels collapsible/resizable; canvas resamples on size change |
| accessibility | attribute groups labelled; disabled reasons visible |
| Figma frame status | `APPROVED_SPEC`; include toast and collapsed panels |

## 8. S3 Lobby

| Field | Contract |
|---|---|
| screen ID | `S3_LOBBY` |
| entry condition | main game CTA, leave room |
| exit condition | create/join success -> `C_ROOM_LOBBY`; back/main nav |
| visible data | room list, public/private, host, players/max, phase/elapsed, create form |
| user actions | refresh, quick join, create public/private, select room, private password submit |
| controller callbacks | `refreshRooms()`, `createRoom(payload)`, `enterPublicRoom()`, `enterRoom(roomId,password)` |
| loading | room refresh/create/join |
| empty | no joinable room |
| success | current room set and realtime join starts |
| error | no public room, invalid password, full room, not found |
| offline | remote mode cannot create/join; mock mode can use mock rooms |
| reconnecting | room list may show stale; remote realtime indicator only |
| permission/disabled | full/running rooms disabled; private requires password |
| localStorage | mock rooms/passwords in mock mode |
| API | `listRooms`, `createRoom`, `joinPublicRoom`, `joinRoom` |
| realtime | `RoomRealtime.joinRoom` after REST success |
| keyboard | form submit, room cards buttons reachable |
| responsive rules | cards wrap; create panel does not hide list at 1280x720 |
| accessibility | private modal focus trap; disabled reasons text |
| Figma frame status | `CONTRACT_FIRST`; design after this contract |

## 9. C Room Lobby

| Field | Contract |
|---|---|
| screen ID | `C_ROOM_LOBBY` |
| entry condition | currentRoom exists and phase is `lobby` |
| exit condition | host/start -> `S4_MAP_BUILD`; leave -> `S3_LOBBY` |
| visible data | player slots, host, ready states, realtime status, start requirements |
| user actions | ready toggle, start, leave |
| controller callbacks | `toggleLobbyReady()`, `advanceRoomPhase()`, `leaveRoom()` |
| loading | realtime joining/connecting |
| empty | empty slots |
| success | all non-host ready and enough players enables start |
| error | realtime offline, not enough players, start denied |
| offline | remote mode disables start if room state cannot sync; mock mode may allow demo override |
| reconnecting | show reconnecting and disable destructive controls |
| permission/disabled | non-host cannot start; host cannot ready toggle |
| localStorage | none directly |
| API | no direct API after room entry |
| realtime | room joined/state, lobby ready, phase changed |
| keyboard | ready/start/leave buttons reachable |
| responsive rules | player slots stay stable at 2-4 players |
| accessibility | ready state text not color-only |
| Figma frame status | `CONTRACT_FIRST`; design after contract |

## 10. S4 Map Build

| Field | Contract |
|---|---|
| screen ID | `S4_MAP_BUILD` |
| entry condition | currentRoom phase `building` |
| exit condition | submit/all ready/timer expiry -> `D_VALIDATION` |
| visible data | timer, budget, asset shelf, frequent assets, tools, start/goal, 24x10 Phaser board |
| user actions | select/place/move/erase asset, move start/goal, vote +/-15s, test, submit |
| controller callbacks | `submitMapSegment(payload)`, `requestTimeVote(delta)`, `advanceRoomPhase()`, Phaser `onToggleCell`, `onDropAsset` |
| loading | submit pending, build test loading |
| empty | no user assets still shows system assets |
| success | local map locked after submit; player ready |
| error | overlap, budget exceeded, endpoint invalid, submit failure |
| offline | remote mode cannot rely on room sync; local editing may continue until submit error |
| reconnecting | lock remote-affecting controls; preserve local draft in memory |
| permission/disabled | locked after submit; invalid placements disabled/rejected |
| localStorage | none for map draft currently; `TBD-CONTRACT` if draft persistence needed |
| API | `saveMapSegment` |
| realtime | segment snapshot/submitted, time vote, timer tick, phase changed |
| keyboard | Phaser owns A/D/Space only in test modal; editor keyboard shortcuts `TBD-CONTRACT` |
| responsive rules | Phaser board visible; HUD does not cover essential cells |
| accessibility | non-canvas controls accessible; canvas has textual status/summary |
| Figma frame status | `CONTRACT_FIRST`; preserve Phaser island |

## 11. D Validation

| Field | Contract |
|---|---|
| screen ID | `D_VALIDATION` |
| entry condition | currentRoom phase `validating` and currentSegment exists |
| exit condition | clear/fail/all records/timer expiry -> `M_MERGING` |
| visible data | timer, PlaytestCanvas, current validation status, players waiting |
| user actions | play segment, retry/reset, proceed after fail/timeout |
| controller callbacks | `validateCurrentSegment(cleared, clearTimeMs)`, `markValidationCleared()`, Phaser `onClear` |
| loading | validation record submit pending |
| empty | no current segment -> error/empty state |
| success | cleared record stored and player ready |
| error | validate API failure, segment hash not found |
| offline | remote mode validation result may not submit; mock mode local record |
| reconnecting | preserve local clear state; retry submit when user acts |
| permission/disabled | after record, controls disabled except wait/leave if allowed |
| localStorage | none |
| API | `validateMapSegment` |
| realtime | validation completed/result, timer tick, phase changed |
| keyboard | Phaser A/D or arrows, Space, S/down |
| responsive rules | PlaytestCanvas visible at 768x420 or scaled wrapper without overlap |
| accessibility | canvas control help outside canvas; status text |
| Figma frame status | `CONTRACT_FIRST`; preserve Phaser island |

## 12. M Merging

| Field | Contract |
|---|---|
| screen ID | `M_MERGING` |
| entry condition | currentRoom phase `merging` |
| exit condition | merge complete and min display delay -> `E_RACE` |
| visible data | merge progress, validated segment count, fallback flag, global placement count |
| user actions | none except leave if product allows; current MVP auto advances |
| controller callbacks | `mergeCurrentRoomMap()`, `advanceRoomPhase()` |
| loading | merge pending |
| empty | no validated segments -> fallback segment notice |
| success | merged map available |
| error | merge failure; fallback if API null in mock/local |
| offline | remote mode merge cannot complete without server; mock can build fallback/local map |
| reconnecting | wait/retry state |
| permission/disabled | no phase controls unless host/dev override |
| localStorage | none |
| API | `mergeRoomMap` |
| realtime | map merged, phase changed |
| keyboard | no special shortcuts |
| responsive rules | compact progress state, no canvas |
| accessibility | progress message announced |
| Figma frame status | `CONTRACT_FIRST`; derived intermediate screen |

## 13. E Race

| Field | Contract |
|---|---|
| screen ID | `E_RACE` |
| entry condition | currentRoom phase `racing` and mergedMap available or fallback state |
| exit condition | all finished/timer/overtime/manual results -> `F_RESULTS` |
| visible data | RaceCanvas, timer, rank/progress, freeze penalty, overtime markers |
| user actions | play race; optional results button |
| controller callbacks | `updateRaceProgress(progressById)`, `broadcastRacePosition(position)`, `recordRaceFinish(playerId, finishTimeMs)`, Phaser `onProgress`, `onFinish` |
| loading | RaceCanvas mount |
| empty | missing mergedMap -> fallback/error state |
| success | local finish recorded; results final received |
| error | realtime position send failure, missing map |
| offline | remote mode shows offline and does not fake remote racers; mock mode local peers may exist |
| reconnecting | continue local play but mark remote positions stale |
| permission/disabled | freeze penalty disables local movement for penalty window inside Phaser |
| localStorage | none |
| API | no direct API in current contract |
| realtime | race position, race finish, timer tick, phase/results final |
| keyboard | Phaser A/D or arrows, Space, S/down |
| responsive rules | canvas visible; HUD outside critical viewport |
| accessibility | HUD mirrors essential race status outside canvas |
| Figma frame status | `CONTRACT_FIRST`; preserve Phaser island |

## 14. F Results

| Field | Contract |
|---|---|
| screen ID | `F_RESULTS` |
| entry condition | currentRoom phase `finished` or `results:final` received |
| exit condition | leave -> `S3_LOBBY` |
| visible data | ranking, winner, local player highlight, finished/unfinished, validation penalty |
| user actions | leave room, view result details |
| controller callbacks | `leaveRoom()` |
| loading | waiting for `results:final` if local phase changed first |
| empty | no players -> error/empty room result |
| success | sorted ranking visible |
| error | malformed results payload |
| offline | show last local ranking with stale indicator; remote mode should not fabricate final results |
| reconnecting | waiting/reconnecting status |
| permission/disabled | leave always available unless confirmation modal open |
| localStorage | none |
| API | no direct API in current contract |
| realtime | results final, room state |
| keyboard | leave button reachable |
| responsive rules | result rows fit 2-4 players without overflow |
| accessibility | rank text not color-only; local player labelled |
| Figma frame status | `CONTRACT_FIRST`; design after contract |

## 15. Global Overlay Inventory

| Overlay | Owner screens | Contract |
|---|---|---|
| Settings modal | S2 shell | Route overlay, focus trap, storage-backed settings |
| Asset detail modal | S2b | Route overlay with asset id; action tabs and cooldown |
| Asset load modal | B | Local overlay; mine/others tabs |
| Private room password modal | S3 | Local overlay; invalid password error |
| Build test modal | S4 | Local overlay with PlaytestCanvas; no persistence |
| Toast | S2/B/S2b | Global notification queue; Asset Studio success uses toast + warehouse CTA |
