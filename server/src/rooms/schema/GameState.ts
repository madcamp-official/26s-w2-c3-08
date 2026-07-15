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
  @type("boolean") grounded = true;      // 다른 플레이어 점프/착지 사운드 재현용 (§listener)
  @type("int8") touchingWall: number = 0; // 0/1/-1 — grounded와 조합해 벽잡기(클링) 재현
  @type("boolean") dead = false;         // 다른 플레이어 사망(피격) 사운드 재현용
  @type("uint16") wallJumpSeq: number = 0; // 벽점프 발동 누적 카운터(순간 플래그는 30hz relay가 놓칠 수 있어 카운터로)
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
  // 현재 선택된 행동 종류(behavior evaluate.ts actionChanged) — 클라가 전환 시점에 패턴별 사운드/연출 재생
  @type("string") currentAction = "";
  // 재생성 유예 종료 절대시각(서버 clock, §부활유예) — 접촉 피해는 클라 로컬 판정이라 이 값으로 유예 판정
  @type("number") graceEndsAt = 0;
}

export class BlockState extends Schema {
  @type("number") x = 0;                 // 이동 블록 현재 좌상단
  @type("number") y = 0;
  @type("number") vx = 0;                // dead reckoning용 (§21-1, 이동 발판 보간)
  @type("number") vy = 0;
  @type("boolean") active = true;        // 파괴/재생성
  @type("boolean") emptied = false;      // 물음표 소진
  @type("boolean") visibleNow = true;    // 스위치·점멸 반영 (서버 계산)
  @type("boolean") reappearing = false;  // 재생성 유예 중(비충돌·점멸) — active=false이지만 화면엔 보여야 함
  @type("boolean") crumbling = false;    // 접촉반응(§A-2) 발동 유예 중 — 금가기+흔들림 텔레그래프
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

export class CarryableState extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("boolean") alive = true;
  @type("string") heldBy = "";
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MonsterState }) monsters = new MapSchema<MonsterState>();
  @type({ map: BlockState }) blocks = new MapSchema<BlockState>();
  @type({ map: ItemState }) items = new MapSchema<ItemState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @type({ map: CarryableState }) carryables = new MapSchema<CarryableState>();
  @type("boolean") switchOn = false;
  @type("number") serverTime = 0;        // 선딜 절대시각 기준 클록
}
