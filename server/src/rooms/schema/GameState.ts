// 동기화 스키마. 플레이어 = relay(각 클라 로컬 권위 §14),
// 몬스터·발사체·블록·아이템·스위치 = 서버 권위(§21·§60).
import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  @type("number") w = 64;
  @type("number") h = 115;
  @type("int8") facing: number = 1;
  @type("uint8") pound: number = 0;      // 0/1/2
  @type("boolean") crouch = false;
  @type("boolean") slide = false;
  @type("number") spinLeftMs = 0;
  @type("boolean") invincible = false;
  @type("boolean") frozen = false;       // 아이템 획득 0.4초
  @type("uint8") sizeStage: number = 2;
  @type("uint8") hp: number = 1;
  @type("string") nickname = "";
  @type("number") tick = 0;
  @type("string") holding = "";          // 들고 있는 아이템/껍질 id
}

export class MonsterState extends Schema {
  @type("string") asset = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;                // dead reckoning용 속도 (§21-1)
  @type("number") vy = 0;
  @type("number") w = 64;
  @type("number") h = 64;
  @type("int8") facing: number = 1;
  @type("boolean") alive = true;
  @type("boolean") stunned = false;
  @type("boolean") hidden = false;       // 잠복
  @type("number") hitCount = 0;
  @type("number") hp = 1;
  // 선딜 (§23): 시작 시 서버가 실행 절대시각 예약 → 클라가 재생속도 조절
  @type("string") windupAnim = "";
  @type("number") windupEndsAt = 0;      // 서버 clock 기준 ms
}

export class BlockState extends Schema {
  @type("number") x = 0;                 // 이동 블록 현재 좌상단
  @type("number") y = 0;
  @type("boolean") active = true;        // 파괴/재생성
  @type("boolean") emptied = false;      // 물음표 소진
  @type("boolean") visibleNow = true;    // 스위치·점멸 반영 (서버 계산)
}

export class ItemState extends Schema {
  @type("string") kind = "speed";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("boolean") available = true;
}

export class ProjectileState extends Schema {
  @type("string") asset = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  @type("boolean") stompable = false;
  @type("string") effect = "damage";
  @type("string") ownerId = "";
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MonsterState }) monsters = new MapSchema<MonsterState>();
  @type({ map: BlockState }) blocks = new MapSchema<BlockState>();
  @type({ map: ItemState }) items = new MapSchema<ItemState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @type("boolean") switchOn = false;
  @type("number") serverTime = 0;        // 선딜 절대시각 기준 클록
}
