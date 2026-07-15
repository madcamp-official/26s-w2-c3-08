// 월드 정의 — 서버 PhysicsRoom 로드와 클라 테스트 하네스가 같은 형태를 쓴다(§14 동일 소스 원칙).
// 원래 server/src/rooms/base/PhysicsRoom.ts에 있던 것을 shared로 이동 — 클라가 라인 지형을
// 스스로 조립(mergeLines)할 수 있어야 정확한 리스폰·골 판정이 가능하기 때문.
import type { Terrain } from "../physics/terrain.js";
import type { BlockSpec } from "../parts/block.js";
import type { MonsterSpec } from "../parts/monster.js";
import type { ItemSpec } from "../parts/item.js";
import type { LineBounds } from "../parts/world.js";

export interface CarryableDef { id: string; x: number; y: number }

export interface WorldDef {
  terrain: Terrain;
  carryables?: CarryableDef[];
  blocks: BlockSpec[];
  monsters: MonsterSpec[];
  items: ItemSpec[];
  line: LineBounds;
  spawn: { x: number; y: number };
}
