// 테스트 모드 — 방식: 매번 새 MapLine 행 생성(2026-07-16 확정, 시간 관계상 덮어쓰기 API 없이 단순하게).
// [테스트하기]: 현재 배치 → POST /api/lines 저장 → joinOrCreate("testline", {lineId}) →
// 맵 캔버스 영역에만 BaseworldScene 마운트(서버 권위 물리 — 로컬 시뮬 아님). 골 판정·리스폰 전부 서버가 처리.
// 아이템/배경은 저장 API가 아직 block/monster만 허용해서 이 시점엔 제외(§engine/placement.ts 주석 참조).
import { Client, type Room } from "@colyseus/sdk";
import { mergeLines, type LineRecord } from "shared/build";
import { toLineData, validateEditorLine } from "../engine/serialize.js";
import { useEditorStore } from "../editorStore.js";
import { startGame, stopGame } from "../../rooms/baseworld/boot.js";
import { worldFromMerged } from "../../rooms/baseworld/sceneWorld.js";
import { HTTP_BASE } from "../../net/rest.js";
import { useSessionStore } from "../../store/session.js";
import { useRoomStore } from "../../store/room.js";
import { TESTLINE_MSG, type TestPassedPayload } from "shared/race";

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;

let client: Client | null = null;
function getClient(): Client {
  if (!client) client = new Client(SERVER_URL);
  return client;
}

let activeRoom: Room | null = null;
let canvasHostEl: HTMLElement | null = null;

/** MapCanvas가 마운트 시 자기 호스트 div를 등록 — 테스트 시작 시 여기에 Phaser를 얹는다. */
export function setCanvasHost(el: HTMLElement | null): void { canvasHostEl = el; }
export function getCanvasHost(): HTMLElement | null { return canvasHostEl; }

export type TestBadge = "unverified" | "running" | "passed" | "error";

/** 저장 가능한 카테고리(block/monster/item — 2026-07-16 item 백엔드 추가)만 추려 LineData 직렬화. */
function buildTestableLineData() {
  const s = useEditorStore.getState();
  const placements = Object.values(s.placements)
    .filter((p) => p.category === "block" || p.category === "monster" || p.category === "item");
  return toLineData("에디터 테스트", placements, s.startFlag, s.endFlag);
}

/**
 * 테스트 시작 — 저장→룸입장→canvasHost(등록된 MapCanvas 호스트) 안에 게임 마운트.
 * onBadge로 상태 변화 통지(호출부가 UI 뱃지에 반영).
 */
export async function startTest(onBadge: (b: TestBadge, msg?: string) => void): Promise<void> {
  const canvasHost = canvasHostEl;
  if (!canvasHost) { onBadge("error", "캔버스를 찾을 수 없음"); return; }

  const line = buildTestableLineData();
  const err = validateEditorLine(line);
  if (err) { onBadge("error", err); return; }

  const token = useSessionStore.getState().token;
  if (!token) { onBadge("error", "로그인 필요"); return; }

  onBadge("running", "저장 중…");
  // 룸 연결 상태(building)면 방 코드를 함께 저장 — 레이스 병합(resolveMemberLines)이
  // sourceRoomId=이 방 코드 + 내 userId 기준으로 "내 라인"을 찾으므로 이게 빠지면 내 라인이 레이스에 안 쓰임.
  const roomCode = (useRoomStore.getState().room?.state as { code?: string } | undefined)?.code;
  const res = await fetch(`${HTTP_BASE}/api/lines`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-token": token },
    body: JSON.stringify({
      name: line.name, tileLength: line.tileLength, startFlag: line.startFlag, endFlag: line.endFlag,
      roomCode: roomCode || undefined,
      placements: line.placements.map((p) => ({ assetId: p.assetKey, x: p.x, y: p.y, flipX: p.flipX, endX: p.endX, endY: p.endY })),
    }),
  });
  if (!res.ok) { onBadge("error", `저장 실패 ${res.status}`); return; }
  const { lineId } = (await res.json()) as { lineId: string | number };

  // 서버가 저장한 그대로를 다시 받아 병합 — 서버(TestLineRoom)와 완전히 같은 소스로 월드를 만든다(§14).
  // 로컬 배치 상태를 직접 쓰지 않는 이유: 서버 화이트리스트/정규화가 걸러낸 결과와 어긋나면
  // "화면에는 있는데 서버 판정엔 없는" 불일치가 생기기 때문.
  const lineRes = await fetch(`${HTTP_BASE}/api/lines/${lineId}`);
  if (!lineRes.ok) { onBadge("error", `라인 조회 실패 ${lineRes.status}`); return; }
  const lineRecord = (await lineRes.json()) as LineRecord;
  let world;
  try {
    world = worldFromMerged(mergeLines([lineRecord]));
  } catch (e) {
    onBadge("error", e instanceof Error ? e.message : "월드 조립 실패");
    return;
  }

  try {
    const room = await getClient().joinOrCreate("testline", { userToken: token, lineId: String(lineId) });
    activeRoom = room;
    room.onMessage(TESTLINE_MSG.testPassed, (_m: TestPassedPayload) => onBadge("passed", "테스트 통과!"));
    room.onLeave(() => { activeRoom = null; });
    startGame(room, canvasHost, world);
    onBadge("running", "테스트 중 — 방향키/스페이스로 조작");
  } catch (e) {
    onBadge("error", e instanceof Error ? e.message : "룸 입장 실패");
  }
}

/** 테스트 중단 — 룸 나가고 게임 언마운트, 에디터 화면 복귀. */
export function stopTest(): void {
  stopGame();
  void activeRoom?.leave();
  activeRoom = null;
}

export function isTesting(): boolean {
  return activeRoom !== null;
}
