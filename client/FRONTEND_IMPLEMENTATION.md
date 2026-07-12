# Frontend Implementation Plan

`docs/LSJ/plan.md`와 `docs/KJH/screen-design.md` 기준으로 프론트 MVP를 구현한 범위와 검증 경로를 정리한다. 백엔드 없이도 기본 Mock 모드로 전체 시연이 가능해야 한다.

## 구현 범위

| 흐름 | 구현 파일 | 상태 |
|---|---|---|
| 닉네임 로그인, 세션 복원, 설정 | `src/App.tsx`, `src/store/appStore.ts`, `src/net/api.ts` | 완료 |
| 메인, 아바타 패널, 창고 진입 | `src/App.tsx`, `src/App.css` | 완료 |
| 아바타 제작 | `src/App.tsx`, `src/components/AvatarCreator.tsx` | 완료 |
| 에셋 스튜디오 | `src/App.tsx`, `src/game/assetRules.ts` | 완료 |
| 내 창고, 상세 검수, 재생성, 장착 | `src/App.tsx`, `src/store/appStore.ts` | 완료 |
| 로비, 공개/비공개 방, 빠른 입장 | `src/App.tsx`, `src/net/api.ts` | 완료 |
| 로컬 실시간 폴백 | `src/net/realtime.ts`, `src/store/appStore.ts` | 완료 |
| 맵 제작, 32x32 그리드, 시간 투표, 테스트 | `src/App.tsx`, `src/game/MapEditorCanvas.tsx`, `src/game/PlaytestCanvas.tsx` | 완료 |
| 검증, 병합, 레이스, 결과 | `src/App.tsx`, `src/game/PlaytestCanvas.tsx`, `src/game/RaceCanvas.tsx` | 완료 |
| 도메인 접속 안정화 | `vite.config.ts`, `index.html` | 완료 |

## 시연 흐름

1. `npm run dev --workspace client`를 실행한다.
2. `https://mad-mario.madcamp-kaist.org/` 또는 `http://localhost:5174/`로 접속한다.
3. 닉네임으로 로그인한다.
4. 아바타/에셋을 하나 제출하고 창고에서 생성 상태를 확인한다.
5. 로비에서 공개방을 만들거나 공개방 빠른 입장을 사용한다.
6. 제작 시작 후 에셋을 배치하고 `테스트 하기`로 맵을 확인한다.
7. `제작 완료` 후 검증 페이즈에서 GOAL에 도달하거나 실패로 진행한다.
8. 병합 후 레이스를 진행하고 결과 화면에서 완주/거리순/패널티를 확인한다.

## 검증 체크리스트

- `npm run lint --workspace client -- --quiet`
- `npm run smoke --workspace client`
- `npm run build --workspace client`
- `git diff --check`
- 도메인 HTML 200 응답 확인
- `/src/main.tsx`, `/src/App.tsx`, `/src/net/api.ts`, `/src/store/appStore.ts` 200 응답 확인

## MVP 경계

- 백엔드는 구현하지 않는다.
- `VITE_REMOTE_API=true`일 때만 원격 REST 호출을 시도한다.
- 기본값은 Mock/localStorage와 BroadcastChannel 로컬 실시간 폴백이다.
- AI 생성 지연/실패가 있어도 기본 아바타와 기본 에셋으로 게임 루프가 계속 진행되어야 한다.
