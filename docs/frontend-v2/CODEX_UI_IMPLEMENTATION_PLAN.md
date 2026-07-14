# Codex UI Implementation Plan

작성일: 2026-07-13  
범위: Frontend V2 code-first UI 전환 계획. 이 문서는 구현 계획이며 런타임 코드를 변경하지 않는다.

## 1. 기준

이 계획은 Figma AI, 이미지 생성물, legacy UI 캡처를 디자인 원본으로 삼지 않는다.

우선순위는 다음이다.

1. `docs/frontend-v2/decisions/product-decisions.md`
2. `docs/frontend-v2/contracts/*`
3. `docs/frontend-v2/decisions/drawing-engine-adr.md`
4. `docs/KJH/screen-design.md`
5. `docs/KJH/asset-attributes.md`
6. `docs/KJH/player-spec.md`
7. `docs/KJH/ai-pipeline.md`
8. `docs/LSJ/plan.md`
9. 현재 runtime behavior and code
10. `docs/frontend-v2/FINAL_PLAN.md`

`FINAL_PLAN.md`의 오래된 source order, Drawing Engine 후보 단계, remote fallback 표현은 최신 product decisions, contracts, ADR보다 우선하지 않는다. 관련 migration gap은 conflict register의 C-004, C-016, C-014를 따른다.

## 2. Code-First Source Of Truth

V2 디자인 원본은 다음 산출물의 조합이다.

| Source | 역할 | 금지 |
|---|---|---|
| React presentational components | 실제 제품 UI의 구조, 상태, variant 원본 | store/API/realtime/localStorage 직접 import 금지 |
| Design tokens | 색, 간격, 반경, typography, opacity, effect 원본 | token source 외 raw UI hex 사용 금지 |
| UI Lab | 컴포넌트와 shell의 interactive inspection 원본 | legacy JSX/CSS 복사 금지 |
| State Gallery | 화면별 state fixture 원본 | runtime transport, API path, socket event 노출 금지 |
| Playwright screenshots | 시각 승인과 regression 원본 | 수동 캡처만으로 승인 금지 |
| Copy deck | visible UI 문구 원본 | 컴포넌트 내부 임의 문구 추가 금지 |

Figma를 사용하더라도 이 code-first source를 반영하는 보조 산출물로만 다룬다. Figma AI import, Codia import, 이미지 벡터화 결과는 `reference`로만 보관하고 V2 컴포넌트 원본으로 쓰지 않는다.

## 3. Target Directory Structure

V2 구현은 legacy `client/src/App.tsx`와 `client/src/App.css`를 incrementally restyle하지 않고 아래 구조에 새로 만든다.

```text
client/
  ui-v2.html
  src/
    app/
      AppV2.tsx
      AppV2Providers.tsx
      AppV2Router.tsx
      ui-v2-main.tsx
      shells/
        LauncherShell.tsx
        StudioShell.tsx
        GameShell.tsx
    pages/
      launcher/
      studio/
      game/
      lab/
      state-gallery/
    features/
      session/
      assets/
      studio/
      lobby/
      room/
      game-flow/
      settings/
    design-system/
      tokens/
      primitives/
      components/
      icons/
      styles/
    infrastructure/
      api/
      realtime/
      storage/
      phaser/
      config/
    fixtures/
      assets/
      rooms/
      screens/
      state-gallery/
```

Legacy files stay runnable during migration:

- keep `client/index.html` and `client/src/main.tsx` on legacy until the V2 root switch gate;
- add `client/ui-v2.html` as a separate Vite entry for V2 work;
- do not rename `client/src/App.tsx` to `LegacyApp.tsx`;
- do not delete `client/src/App.tsx`, `client/src/App.css`, or `client/src/components/AvatarCreator.tsx` until the explicit final removal phase is authorized.

## 4. Separate `ui-v2.html` Entry

`ui-v2.html` is the V2 sandbox entrypoint.

| Item | Plan |
|---|---|
| HTML entry | `client/ui-v2.html` |
| React entry | `client/src/app/ui-v2-main.tsx` |
| Default mode | development/test missing env resolves to `mock/local` through `modeConfig` |
| Purpose | UI Lab, State Gallery, and V2 page assembly without touching legacy root |
| Rule | V2 entry must not import legacy `App.tsx` or `App.css` |

The legacy app remains the default runtime until Launcher, Studio, Game, Visual/E2E, and parity gates pass.

## 5. UI Lab Strategy

UI Lab is the interactive design workbench.

| Area | Requirement |
|---|---|
| Route | `ui-v2.html` entry exposes a lab page, recommended path `#/lab` or in-memory route |
| Data | uses `client/src/fixtures/**` only |
| Coverage | all design-system primitives, product components, shell patterns, and motion-free states |
| Controls | variant, size, density, disabled, loading, error, offline, reconnecting, long text |
| Accessibility | keyboard traversal, focus rings, icon labels, modal focus trap test controls |
| Styling | tokens only; no legacy class names; no copied legacy CSS |

UI Lab is not a marketing page. It is a dense inspection tool for implementers and reviewers.

## 6. State Gallery Strategy

State Gallery is the screenshot source.

Every gallery item is a serializable record:

```ts
interface StateGalleryCase {
  id: string
  screenId: string
  shell: 'launcher' | 'studio' | 'game'
  state: string
  viewportTags: Array<'1280x720' | '1440x900' | '1920x1080'>
  fixtureName: string
}
```

Rules:

- gallery cases render presentational views with fixture props;
- no Zustand, API client, realtime client, localStorage helper, Phaser scene, or env flag imports in gallery views;
- Game Shell cases may use Phaser wrapper fixtures only after bridge isolation exists;
- each case exposes stable attributes from `component-contracts.md`;
- long names, empty lists, loading, offline, reconnecting, modal-open, and error states are first-class gallery cases.

## 7. Implementation Order

Use the same sequence for every screen and feature:

```text
fixture -> presentational view -> page controller/feature hook -> use case/domain state -> port -> adapter
```

This keeps UI review possible before runtime wiring and prevents API paths, socket events, storage keys, or transport names from leaking into presentational components.

### 7.1 Foundation

1. token source and generated CSS plan;
2. reset, global, accessibility layers;
3. Button, IconButton, fields, tabs, badge, progress, modal, toast;
4. LauncherShell, StudioShell, GameShell;
5. UI Lab and State Gallery scaffolding.

### 7.2 Launcher Gate Order

1. S1 Login
2. S2 Main
3. S2b Warehouse
4. S2c Settings Modal
5. S3 Lobby
6. C Room Lobby

S1, S2, S2b, S2c follow `screen-design.md`; S3 and C follow `screen-state-matrix.md` contract-first states.

### 7.3 Studio Gate Order

1. Drawing Engine adapter interface using the ADR direction: Canvas 2D + offscreen workspace buffer;
2. DrawingViewport, DrawingToolbar, PaletteGrid, AttributeForm;
3. A Avatar Studio;
4. B Asset Studio;
5. AssetLoadModal and dirty/content-hash submit blocking.

`react-sketch-canvas` is legacy reference only, not the V2 default engine. The V2 contract is 256x512 visible avatar canvas, 768x1536 workspace, overlay-excluded export and eyedropper, unified history, and paste/drop blocking.

### 7.4 Game Gate Order

1. S4 Map Build React HUD and side panels;
2. D Validation shell and DOM status;
3. M Merging intermediate screen;
4. E Race shell and HUD;
5. F Results.

Phaser gameplay behavior is preserved. React may add wrapper contracts, lifecycle cleanup, resize integration, typed bridge events, and DOM accessibility summaries only.

## 8. Playwright Screenshot Approval Flow

Minimum viewport matrix:

- 1280x720
- 1440x900
- 1920x1080

Flow:

1. Add or update a State Gallery case.
2. Render it through `ui-v2.html`.
3. Capture screenshots in the viewport matrix.
4. Store first-run captures as evidence screenshots under `client/test-results/**/evidence`.
5. Review evidence for layout overlap, clipped text, canvas visibility, focus states, and state semantics.
6. Create or update golden baselines only after the product/design reviewer approves the evidence.
7. Block V2 completion if any required screen state lacks screenshot coverage.

Evidence screenshot paths and the viewport matrix are implemented. Golden/baseline storage and approval owner remain a product review step before default switch.

## 9. Gates

### Launcher Gate

Pass criteria:

- S1, S2, S2b, S2c, S3, C render through LauncherShell;
- all required loading, empty, success, error, offline, reconnecting states exist in State Gallery;
- settings and asset modals trap focus, close on ESC, and restore focus;
- remote mode errors do not fall back to mock/local transport;
- all icon-only buttons have accessible names.

### Studio Gate

Pass criteria:

- A and B render through StudioShell;
- Drawing Engine contract passes core and browser acceptance;
- avatar export is 256x512 from centered 768x1536 workspace;
- checker/grid/outside dim overlays are not exported or sampled by eyedropper;
- image upload and paste/drop import are blocked;
- non-avatar submit stays in Asset Studio with toast and warehouse CTA;
- loaded unchanged source cannot be submitted.

### Game Gate

Pass criteria:

- S4, D, M, E, F render through GameShell or approved game/intermediate shell;
- Phaser canvas remains visible and is not covered by HUD at required viewports;
- MapEditor, Playtest, Race wrappers preserve current gameplay behavior;
- DOM mirrors essential timer, budget, validation, race, freeze, overtime, and result status;
- no physics, collision, map rule, freeze, ranking, or overtime changes are introduced by visual UI work.

### Existing UI Removal Gate

Removal is allowed only after:

- G0 through G8 in `migration-gates.md` pass;
- S1 through F plus M parity is covered by State Gallery and Playwright screenshots;
- legacy root has been switched to V2 and smoke/build/lint pass;
- the user explicitly authorizes the final removal phase.

Final removal candidates:

- `client/src/App.tsx`
- `client/src/App.css`
- `client/src/components/AvatarCreator.tsx`
- unused guide/default Vite assets after reference checks.

## 10. Commit Strategy

Keep commits reviewable and gate-aligned.

| Commit type | Scope |
|---|---|
| docs | planning, contracts, copy deck, visual checklist only |
| foundation | tokens, reset, primitives, shell skeletons |
| fixture/view | fixtures and presentational views, no runtime adapter |
| controller | page hooks/use cases/domain state |
| adapter | API/realtime/storage/Phaser bridge wiring |
| visual | State Gallery cases and Playwright baselines |
| cleanup | legacy removal after explicit authorization |

Rules:

- do not mix unrelated gameplay changes into UI commits;
- do not add a production dependency without reporting why required, alternatives, and bundle/runtime impact;
- keep legacy runnable until the removal gate;
- every implementation wave runs the commands listed in `migration-gates.md` that exist in the workspace.

## 11. Current Client Notes

Current `client/package.json` scripts include:

- `dev`
- `build`
- `lint`
- `smoke`
- `tokens:generate`
- `tokens:check`
- `primitives:check`
- `core:check`
- `shells:check`
- `studio:check`
- `login:check`
- `main:check`
- `warehouse:check`
- `avatar-studio:check`
- `asset-studio:check`
- `routes:check`
- `flow:check`
- `lobby-room:check`
- `game:check`
- `realtime:check`
- `launcher:check`
- `browser-env:check`
- `test:launcher-screenshots`
- `test:lobby-room`
- `test:remote-v2-browser`
- `test:accessibility`
- `test:studio-game-screenshots`
- `test:drawing-browser`
- `preview`

Current client structure keeps legacy runnable while V2 uses an independent entry:

- `client/src/main.tsx` imports `./App.tsx`;
- `client/ui-v2.html` imports `client/src/ui-v2-main.tsx`;
- `client/src/app/AppV2.tsx` owns the V2 prototype route surface;
- `client/src/App.tsx` contains login, main, warehouse, studios, lobby, room phases, drawing UI, and React HUD;
- `client/src/App.css` contains broad legacy styling;
- `client/src/game/**` is protected gameplay code;
- `client/src/infrastructure/config/modeConfig.ts` defines `VITE_DATA_MODE` and `VITE_REALTIME_MODE`;
- `client/src/infrastructure/realtime/socketIoRemoteAdapters.ts` uses backend Socket.IO in remote mode.

## 12. Open Decisions

| ID | Decision needed |
|---|---|
| OPEN-UI-001 | Golden screenshot baseline storage and approval owner; evidence screenshots are implemented under `client/test-results/**/evidence`. |
| RESOLVED-UI-002 | `design/tokens.json` schema and `scripts/generate-design-tokens.mjs` generation/check commands are implemented. |
| RESOLVED-UI-003 | V2 navigation is browser hash URL-backed through `prototypeRouter`. |
| RESOLVED-UI-004 | Remote asset job endpoints and `asset_job:updated` payload are implemented in `backend/` and V2 adapters. |
| RESOLVED-UI-005 | Remote nickname update contract uses `/api/session/nickname`. |
| OPEN-UI-006 | Whether `lucide-react` or another icon source is approved as a production dependency. Current V2 avoids adding an icon library. |
