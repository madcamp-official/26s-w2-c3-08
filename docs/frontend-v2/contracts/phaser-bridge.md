# Frontend V2 Phaser Bridge Contract

작성일: 2026-07-13  
목적: React UI와 Phaser island 사이의 command/event/lifecycle/ownership을 분리한다.

## 1. Boundary Rules

근거: `client/src/game/AGENTS.md`

- Phaser rendering, physics, collision, gameplay timing, race rules, map rules are protected.
- V2 UI may change wrapper contracts, lifecycle cleanup, resize integration, typed bridge events, and accessibility-related surrounding UI.
- Do not rewrite Phaser scenes to match Figma screenshots.
- Do not convert Phaser gameplay into React DOM.

## 2. MapEditorCanvas Bridge

| Direction | Contract |
|---|---|
| React -> Phaser command | `syncState({ placements, selectedAsset, selectedPlacementId, tool, toolLabel, canAffordSelectedAsset, isLocked, getEndpointLabel })` |
| React -> Phaser command | mount new game with board size 24x10, cell 32px |
| React -> Phaser command | CSS custom property `--map-editor-zoom` controls wrapper zoom |
| Phaser -> React event | `onToggleCell(x, y)` from pointer down |
| React DOM -> React event | `onDropAsset(assetId, x, y)` from drag/drop on wrapper |
| scene lifecycle | `new Phaser.Game(...)` on mount; `EditorScene.syncState` on prop changes |
| resize | current wrapper has no `ResizeObserver`; V2 may add wrapper resize integration without changing board rules |
| cleanup | unmount sets `sceneRef.current = null` and `game.destroy(true)` |
| ownership of game state | React/store owns placements, selected tool, budget, endpoint validation, locked state; Phaser renders and reports cell intent |
| protected gameplay | board size, snap cell, placement validation semantics remain React/store + current Phaser visual contract unless explicit gameplay task |

Source evidence:

- `client/src/game/MapEditorCanvas.tsx` `MapEditorCanvasProps`
- `MapEditorCanvas.tsx` `EditorScene.syncState`
- `MapEditorCanvas.tsx` `BOARD_COLS=24`, `BOARD_ROWS=10`, `CELL_PX=32`

## 3. PlaytestCanvas Bridge

| Direction | Contract |
|---|---|
| React -> Phaser command | `syncState(isCleared, segment, resetSignal, onClear)` |
| React -> Phaser command | `segment: MapSegmentSnapshot | null` supplies start/end and asset refs |
| React -> Phaser command | `resetSignal` forces local scene reset |
| Phaser -> React event | `onClear()` when local player reaches goal |
| scene lifecycle | `new Phaser.Game(...)` fixed current render 768x420 |
| resize | current wrapper has no explicit resize; V2 shell may scale host while preserving aspect |
| cleanup | unmount sets scene ref null and `game.destroy(true)` |
| ownership of game state | Phaser owns local playtest physics, collisions, items, monster/platform reactions; React owns phase timer and validation submit |
| protected gameplay | A/D/arrows, Space, S/down controls and physics constants remain protected |

Source evidence:

- `client/src/game/PlaytestCanvas.tsx` `PlaytestCanvasProps`
- `PlaytestCanvas.tsx` `PLAYER`, physics constants, keyboard handlers
- `PlaytestCanvas.tsx` wrapper `useEffect`

## 4. RaceCanvas Bridge

| Direction | Contract |
|---|---|
| React -> Phaser command | `syncState({ players, currentUserId, mergedMap, racePositions, isExtended, elapsedSeconds, onProgress, onFinish })` |
| React -> Phaser command | `racePositions` renders remote racers |
| React -> Phaser command | `isExtended` enables overtime markers |
| Phaser -> React event | `onProgress(progressById, localPosition?)` |
| Phaser -> React event | `onFinish()` |
| scene lifecycle | `new Phaser.Game(...)` fixed current render 768x420 |
| resize | current wrapper has no explicit resize; V2 shell may scale host while preserving canvas visibility |
| cleanup | unmount sets scene ref null and `game.destroy(true)` |
| ownership of game state | Phaser owns local movement, PvP interactions, freeze enforcement, collision, progress computation; React/store owns broadcasting, phase timer, ranking state |
| protected gameplay | freeze seconds, overtime, ranking hooks, player collision/stomp, map projection remain protected without explicit gameplay task |

Source evidence:

- `client/src/game/RaceCanvas.tsx` `RaceCanvasProps`
- `RaceCanvas.tsx` `FREEZE_SECONDS = 15`
- `RaceCanvas.tsx` `onProgress`, `onFinish`

## 5. Bridge Event Naming

Target typed bridge names for V2 wrappers:

```ts
type PhaserBridgeEvent =
  | { type: 'map.cellIntent'; x: number; y: number }
  | { type: 'map.assetDropIntent'; assetId: string; x: number; y: number }
  | { type: 'playtest.cleared' }
  | { type: 'race.progress'; progressById: Record<string, number>; localPosition?: unknown }
  | { type: 'race.finished' }
```

`localPosition` schema is currently `Omit<RacePositionSnapshot, 'userId'>`; any new fields are `TBD-CONTRACT`.

## 6. Resize Contract

| Canvas | Current size | V2 resize target |
|---|---:|---|
| Map editor | `24*32` x `10*32` = 768x320 | wrapper may scale; logical cells remain 24x10 and 32px snap |
| Playtest | 768x420 | wrapper may scale proportionally; Phaser internal size unchanged unless explicit resize task |
| Race | 768x420 | wrapper may scale proportionally; HUD must not cover essential gameplay |

## 7. Migration Gaps

| ID | Gap |
|---|---|
| PHASER-GAP-001 | No `ResizeObserver` or explicit Phaser resize integration exists. |
| PHASER-GAP-002 | Bridge events are callback props, not discriminated union events. |
| PHASER-GAP-003 | Phaser status text is rendered inside canvas; V2 accessibility requires mirrored DOM summaries. |
| PHASER-GAP-004 | Game rules live in Phaser files and `assetRules.ts`, while `shared/physics` is stub. |
