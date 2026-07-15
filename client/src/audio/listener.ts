// 오디오 리스너(귀) 위치 — 매 틱 로컬 플레이어 위치로 갱신(BaseworldScene). sfx.ts가 재생 시 이걸 읽어
// 거리감쇠·스테레오 팬을 계산한다. 리스너 미설정(게임 미실행, 콘솔 오디션 등)이면 감쇠 없이 항상 정면 재생.
import { TUNING } from "shared/physics";

let listener: { x: number; y: number } | null = null;

export function setListenerPosition(x: number, y: number): void {
  listener = { x, y };
}

export function getListenerPosition(): { x: number; y: number } | null {
  return listener;
}

/** 이 거리 이내는 풀 볼륨, 이 밖은 0까지 선형 감쇠 (타일 기준 — tileSize 바뀌어도 비율 유지) */
const FULL_VOLUME_TILES = 3;
const SILENT_TILES = 16;

export interface Spatial {
  volumeMult: number; // 0~1
  pan: number; // -1(좌) ~ 1(우)
}

/** 소스 좌표 → 거리감쇠 배율+팬. 리스너 없으면 항상 { volumeMult:1, pan:0 } (풀 볼륨·정면). */
export function computeSpatial(sourceX: number, sourceY: number): Spatial {
  if (!listener) return { volumeMult: 1, pan: 0 };
  const tile = TUNING.world.tileSize;
  const dx = sourceX - listener.x;
  const dy = sourceY - listener.y;
  const dist = Math.hypot(dx, dy) / tile;

  let volumeMult: number;
  if (dist <= FULL_VOLUME_TILES) volumeMult = 1;
  else if (dist >= SILENT_TILES) volumeMult = 0;
  else volumeMult = 1 - (dist - FULL_VOLUME_TILES) / (SILENT_TILES - FULL_VOLUME_TILES);

  // 팬: 가까우면(±FULL_VOLUME_TILES 이내) 정면 유지, 멀어질수록 좌우 편차를 서서히 반영
  const panRaw = Math.max(-1, Math.min(1, dx / (tile * SILENT_TILES)));
  const pan = volumeMult === 0 ? 0 : panRaw;

  return { volumeMult, pan };
}
