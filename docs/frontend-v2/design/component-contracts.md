# Component Contracts

작성일: 2026-07-13  
범위: Frontend V2 presentational component props/state/accessibility/data attribute contracts.

## 1. Global Rules

Presentational components receive serializable props and callbacks. They must not directly import Zustand stores, API clients, realtime clients, localStorage helpers, Phaser scenes, or environment flags.

Callbacks use intent names, not transport names:

- good: `onSubmitNickname`, `onOpenWarehouse`, `onRetryAsset`, `onToggleReady`
- forbidden: `onPostSession`, `onSocketJoin`, `onWriteLocalStorage`

## 2. State Names

Use these state names in props, fixtures, Story/UI Lab controls, State Gallery cases, and `data-v2-state`.

| Domain | States |
|---|---|
| async | `idle`, `loading`, `submitting`, `success`, `error` |
| data mode | `mock`, `remote`, `offline`, `reconnecting`, `server_unavailable`, `malformed_response` |
| content | `empty`, `populated`, `stale` |
| interaction | `enabled`, `disabled`, `selected`, `pressed`, `expanded`, `collapsed`, `locked` |
| studio | `blank`, `drawing`, `unchanged`, `dirty`, `submitted` |
| asset | `queued`, `generating`, `ready`, `failed` |
| room | `open`, `private`, `full`, `playing`, `joinable`, `not_joinable` |
| timer | `normal`, `warning`, `danger`, `overtime` |
| result | `finished`, `unfinished`, `winner`, `local_player` |

## 3. Data Attribute Rules

Use stable attributes for visual tests and DOM inspection. Do not expose API paths, socket events, storage keys, or transport-specific names.

| Attribute | Value convention | Example |
|---|---|---|
| `data-v2-screen` | lowercase kebab screen id | `s2b-warehouse` |
| `data-v2-shell` | `launcher`, `studio`, `game` | `studio` |
| `data-v2-component` | Pascal component name in kebab case | `asset-card` |
| `data-v2-state` | state names from this document | `generating` |
| `data-v2-variant` | visual variant only | `primary` |
| `data-v2-id` | fixture or domain-safe opaque id | `asset-ready-1` |
| `data-v2-gallery-case` | State Gallery case id | `s4-locked-1440` |

IDs are opaque and must not encode backend routes or socket event names.

## 4. Core Components

| Component | Required props | States/variants | Accessibility |
|---|---|---|---|
| `Button` | `variant`, `size`, `loading`, `disabled`, `fullWidth`, `leadingIcon`, `trailingIcon`, `children`, `onPress` | `primary`, `secondary`, `subtle`, `danger`; `idle`, `loading`, `disabled` | native `button`; loading text remains available; disabled reason supplied nearby |
| `IconButton` | `icon`, `size`, `pressed`, `disabled`, `ariaLabel`, `tooltip`, `onPress` | `default`, `pressed`, `disabled` | required accessible name; tooltip is supplemental only |
| `TextField` | `label`, `value`, `placeholder`, `error`, `helper`, `disabled`, `maxLength`, `onChange`, `onSubmit` | `idle`, `error`, `disabled`, `loading` | label associated; error/helper via `aria-describedby` |
| `TextArea` | `label`, `value`, `placeholder`, `error`, `helper`, `disabled`, `rows`, `onChange` | `idle`, `error`, `disabled` | label associated; character limits visible when relevant |
| `SegmentedControl` | `label`, `options`, `selectedValue`, `disabledValues`, `onChange` | `selected`, `disabled` | roving keyboard or native radio-group semantics |
| `Tabs` | `tabs`, `selectedValue`, `onChange`, `ariaLabel` | `selected`, `disabled`, `badge` | tablist semantics; selected tab announced |
| `FilterChip` | `label`, `selected`, `count`, `disabled`, `onPress` | `selected`, `disabled` | count included in accessible label |
| `Badge` | `tone`, `label`, `icon`, `ariaLabel` | `queued`, `generating`, `ready`, `failed`, `danger`, `neutral` | state text not color-only |
| `ProgressBar` | `value`, `max`, `label`, `indeterminate` | `determinate`, `indeterminate` | progressbar role with value where known |
| `Modal` | `title`, `size`, `dismissible`, `initialFocusRef`, `footer`, `onClose`, `children` | `open`, `closing` | focus trap, ESC close, backdrop rules, focus restoration |
| `Toast` | `tone`, `title`, `message`, `action`, `onDismiss` | `info`, `success`, `error` | live region; action reachable by keyboard |
| `Slider` | `label`, `value`, `min`, `max`, `step`, `muted`, `disabled`, `onChange` | `enabled`, `muted`, `disabled` | keyboard operable; value text exposed |
| `Toggle` | `label`, `checked`, `disabled`, `onChange` | `checked`, `unchecked`, `disabled` | native switch/checkbox semantics |
| `Tooltip` | `content`, `placement`, `triggerId` | `open`, `closed` | no critical information only in tooltip |
| `EmptyState` | `title`, `message`, `action`, `icon` | `empty`, `error` | clear heading; action label specific |

## 5. Product Components

| Component | Required props | States | Accessibility |
|---|---|---|---|
| `LauncherShell` | `title`, `status`, `primaryNav`, `children` | `default`, `loading`, `offline`, `reconnecting` | shell landmark; status announced when persistent |
| `TitleBand` | `title`, `subtitle`, `compact`, `actions` | `default`, `compact` | title is page heading where appropriate |
| `AvatarPanel` | `avatar`, `status`, `estimateText`, `onOpenWarehouse` | `system`, `queued`, `generating`, `ready`, `failed` | clickable region has button semantics and status text |
| `AssetCard` | `asset`, `selected`, `disabled`, `status`, `onOpen`, `actions` | `queued`, `generating`, `ready`, `failed`, `selected`, `disabled` | card action is explicit button; status readable |
| `AssetPreview` | `src`, `alt`, `status`, `animationAction` | `static`, `animated`, `unavailable` | alt describes asset category/name; unavailable text visible |
| `AssetReviewModal` | `asset`, `actionTabs`, `cooldowns`, `onRegenerate`, `onEdit`, `onClose` | `ready`, `working`, `failed`, `cooling_down`, `locked` | modal contract; tabs labelled by action |
| `CooldownButton` | `availableAt`, `loading`, `disabledReason`, `onPress` | `available`, `cooling_down`, `working`, `disabled` | remaining time included in label |
| `RoomCard` | `room`, `disabledReason`, `onJoin`, `onOpenPassword` | `open`, `private`, `full`, `playing`, `disabled` | disabled reason visible; keyboard selectable |
| `PlayerSlot` | `player`, `slotIndex`, `isLocal`, `isHost`, `readyState` | `empty`, `joined`, `ready`, `host`, `local_player` | player status text not color-only |
| `DeviceLinkCode` | `code`, `expiresAt`, `status`, `onIssue`, `onConsume` | `idle`, `issued`, `expired`, `invalid`, `loading` | code text selectable; errors linked to input |
| `HUDTimer` | `remainingMs`, `status`, `label` | `normal`, `warning`, `danger`, `overtime` | timer text visible and announced on major changes |
| `BudgetMeter` | `used`, `limit`, `selectedCost` | `normal`, `warning`, `exceeded` | numbers visible; exceeded state includes text |
| `ResultsRow` | `rank`, `player`, `isLocal`, `isWinner`, `resultLabel` | `finished`, `unfinished`, `winner`, `local_player` | rank and local/winner labels exposed as text |

## 6. Studio Components

| Component | Required props | States | Accessibility |
|---|---|---|---|
| `StudioShell` | `leftPanel`, `rightPanel`, `center`, `panelState` | `left_collapsed`, `right_collapsed`, `resizing` | panel controls have names and states |
| `StudioPanel` | `side`, `title`, `collapsed`, `resizable`, `children` | `expanded`, `collapsed`, `resizing` | collapse button announces side and state |
| `PanelResizeHandle` | `axis`, `disabled`, `onResizeStart` | `idle`, `hover`, `dragging`, `disabled` | keyboard fallback or paired numeric control required |
| `DrawingToolbar` | `activeTool`, `tools`, `onToolChange` | `pen`, `eraser`, `eyedropper`, `move` | toolbar semantics; tool labels visible through tooltip/aria |
| `ToolButton` | `tool`, `active`, `disabled`, `onPress` | `active`, `disabled` | pressed state announced |
| `BrushSizeControl` | `value`, `presets`, `onChange` | `preset`, `custom`, `disabled` | numeric value visible |
| `PaletteGrid` | `swatches`, `selectedColor`, `recentColors`, `opacity`, `onSelect` | `selected`, `recent`, `disabled` | swatches have color names or values in labels |
| `PaletteSwatch` | `color`, `selected`, `transparent`, `onPress` | `selected`, `transparent` | selected state and transparency announced |
| `DrawingViewport` | `workspaceSize`, `visibleFrame`, `checkerMode`, `gridVisible`, `tool`, `status` | `blank`, `drawing`, `move`, `disabled` | canvas wrapper has label and textual status |
| `AttributeField` | `field`, `value`, `disabledReason`, `onChange` | `enabled`, `disabled`, `invalid` | radio/checkbox/select semantics preserved |
| `AssetLoadModal` | `tab`, `assets`, `loading`, `empty`, `onSelect`, `onClose` | `mine`, `others`, `loading`, `empty` | modal contract; tabs labelled |
| `DirtyStateNotice` | `state`, `message`, `action` | `unchanged`, `dirty`, `submitted` | submit blocking reason visible |

## 7. Error Contract

Components receive user-facing error models derived from `error-taxonomy.md`.

```ts
interface ViewError {
  kind:
    | 'validation'
    | 'authentication'
    | 'authorization'
    | 'not_found'
    | 'conflict'
    | 'rate_limit'
    | 'asset_job_failure'
    | 'offline'
    | 'reconnecting'
    | 'server_unavailable'
    | 'malformed_response'
  message: string
  retryable: boolean
  fieldErrors?: Record<string, string[]>
}
```

Presentational components display `message` and expose retry callbacks only when a controller supplies them.
