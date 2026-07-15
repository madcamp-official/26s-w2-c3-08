// 배선 중앙 매핑 — shared 행동의 ctx.emit(kind) + 플레이어 이벤트/플래그 → 사운드 + 이펙트.
// (b) 명령적 방식: BaseworldScene이 이 함수들만 호출하면 됨. shared는 안 건드림.
// 전부 소스 좌표(x,y)를 playSound에 넘겨 거리감쇠·좌우팬(listener.ts)이 자동 적용되게 한다.
import type Phaser from "phaser";
import type { SoundName, EffectName } from "shared/effects";
import { playSound } from "../audio/sfx.js";
import { playEffect } from "./effects.js";
import { screenShake } from "./juice.js";

/** 짧게 반복되는 사운드(스위치 등)의 스팸 방지 — 이름별 최소 간격(ms). 게임 로직(디바운스)과는 무관, 소리만. */
const lastPlayedAt = new Map<SoundName, number>();
function playSoundThrottled(name: SoundName, minGapMs: number, x: number, y: number): void {
  const now = performance.now();
  const last = lastPlayedAt.get(name) ?? -Infinity;
  if (now - last < minGapMs) return;
  lastPlayedAt.set(name, now);
  playSound(name, { x, y });
}

/** MonsterState.currentAction 전환(§actionChanged) → 패턴별 사운드. 이동/대기류(walk·patrol·idle·spin·pendulum)는
 * 매 틱 지속이라 소리 없음(스팸 방지) — 진입 순간이 뚜렷한 패턴만 소리를 붙인다. */
const MONSTER_PATTERN_SOUND: Partial<Record<string, SoundName>> = {
  chase: "aggro",
  fly: "flap",
  crawlSurface: "crawl",
  hop: "hop",
  chargeSide: "charge",
  slamDown: "slam_start",
  shoot: "shoot",
  // teleportTo는 액션 자체 emit("teleported")이 서버 emit 콜백에 라우팅되지 않아(미매핑 kind → 드롭)
  // 클라에 도달할 방법이 없었음 — actionChanged 경로로 대체 커버.
  teleportTo: "teleport",
};
/** 순간이동처럼 위치가 갑자기 바뀌는 패턴은 소리만으론 부족해 시각 텔레그래프도 필요 */
const MONSTER_PATTERN_EFFECT: Partial<Record<string, EffectName>> = {
  teleportTo: "spawnSparkle",
};
export function monsterPatternChanged(scene: Phaser.Scene, actionType: string, x: number, y: number): void {
  const s = MONSTER_PATTERN_SOUND[actionType];
  if (s) playSound(s, { x, y });
  const e = MONSTER_PATTERN_EFFECT[actionType];
  if (e) playEffect(scene, e, x, y);
}

/** 플레이어/물성 이벤트 직접 호출용 (emit 아닌 클라 로컬 상태 전이). 전부 (scene, x, y) — 소스 좌표 필수. */
export const feedback = {
  jump: (_s: Phaser.Scene, x: number, y: number) => playSound("jump", { x, y }),
  land: (s: Phaser.Scene, x: number, y: number) => { playSound("land", { x, y }); playEffect(s, "dust", x, y); },
  stomp: (s: Phaser.Scene, x: number, y: number) => { playSound("stomp", { x, y }); playEffect(s, "hitFlash", x, y); },
  hurt: (s: Phaser.Scene, x: number, y: number) => { playSound("hurt", { x, y }); playEffect(s, "hitFlash", x, y); },
  die: (s: Phaser.Scene, x: number, y: number) => { playSound("die", { x, y }); playEffect(s, "poofDeath", x, y); },
  /** 아이템 획득 — kind별 사운드 구분(강화형은 powerUp, 무적은 revive, 나머지는 기본 pickup) */
  pickup: (s: Phaser.Scene, x: number, y: number, kind?: string) => {
    const sound: SoundName = kind === "sizeUp" || kind === "hpUp" ? "powerUp" : kind === "invincible" ? "revive" : "pickup";
    playSound(sound, { x, y });
    playEffect(s, "pickupGlow", x, y);
  },
  toggleSwitch: (s: Phaser.Scene, x: number, y: number) => {
    // 2026-07-15: 발동 자체가 bonk/pound(단발 트리거)로 바뀌어 접촉 매틱 재토글 버그는 해소됨.
    // 스로틀은 그대로 유지(여러 스위치를 연타할 때의 스팸 방지 목적으로도 유효).
    playSoundThrottled("switch", 500, x, y);
    playEffect(s, "hitFlash", x, y);
  },
  breakBlock: (s: Phaser.Scene, x: number, y: number) => { playSound("break", { x, y }); playEffect(s, "poofDeath", x, y); },
  /** 스프링/트램펄린 밟기 (접촉이 여러 틱 겹칠 수 있어 소리만 스로틀) */
  spring: (s: Phaser.Scene, x: number, y: number) => { playSoundThrottled("boing", 200, x, y); playEffect(s, "hitFlash", x, y); },
  /** 벽점프 킥오프 */
  wallKick: (_s: Phaser.Scene, x: number, y: number) => playSound("wallKick", { x, y }),
  /** 벽 잡기(클링) 시작 */
  wallGrab: (s: Phaser.Scene, x: number, y: number) => { playSound("wallGrab", { x, y }); playEffect(s, "dust", x, y); },
  /** 경사 슬라이딩 시작 */
  slideStart: (s: Phaser.Scene, x: number, y: number) => { playSound("slide", { x, y }); playEffect(s, "dust", x, y); },
  /** 내려찍기 착지 (일반 착지보다 무거운 임팩트) */
  poundLand: (s: Phaser.Scene, x: number, y: number) => {
    playSound("slam_hit", { x, y });
    playEffect(s, "dust", x, y);
    screenShake(s, 100, 0.006);
  },
  /** 천장에 머리 부딪힘 */
  ceilBonk: (s: Phaser.Scene, x: number, y: number) => { playSound("bump", { x, y }); playEffect(s, "hitFlash", x, y); },
  /** PvP: 상대 머리를 밟은 쪽 (겹침 판정이 여러 틱 이어질 수 있어 소리만 스로틀) */
  headstompAttacker: (s: Phaser.Scene, x: number, y: number) => { playSoundThrottled("stomp", 150, x, y); playEffect(s, "hitFlash", x, y); },
  /** PvP: 머리를 밟힌(스턴당한) 쪽 */
  headstompVictim: (s: Phaser.Scene, x: number, y: number) => { playSoundThrottled("stun", 150, x, y); playEffect(s, "stunStars", x, y); },
  /** 몬스터 처치(밟기 외 경로 포함 — alive 전이 감지) */
  monsterDie: (s: Phaser.Scene, x: number, y: number) => { playSound("die", { x, y }); playEffect(s, "poofDeath", x, y); },
  /** 몬스터 기절(밟기 불가·spiky 등) */
  monsterStunned: (s: Phaser.Scene, x: number, y: number) => { playSound("stun", { x, y }); playEffect(s, "stunStars", x, y); },
  /** 몬스터 은신 해제(매복형) */
  monsterEmerge: (s: Phaser.Scene, x: number, y: number) => { playSound("emerge", { x, y }); playEffect(s, "spawnSparkle", x, y); },
  /** 몬스터 재생성(라인 이탈 사망 후 부활) */
  monsterRespawn: (s: Phaser.Scene, x: number, y: number) => { playSound("revive", { x, y }); playEffect(s, "spawnSparkle", x, y); },
  /** 잡기(§30): 집기 성공 */
  grab: (_s: Phaser.Scene, x: number, y: number) => playSound("grab", { x, y }),
  /** 잡기: 허공 잡기 또는 서버 소유권 패배(거부) — 둘 다 "실패" 의미라 같은 소리 재사용 */
  grabDenied: (_s: Phaser.Scene, x: number, y: number) => playSound("grabDenied", { x, y }),
  /** 발사체(몬스터 발사·던진 물체 포함)가 벽/바닥에 맞아 소멸 */
  projectileHit: (s: Phaser.Scene, x: number, y: number) => { playSound("projectileHit", { x, y }); playEffect(s, "dust", x, y); },
  /** 잡기 파츠 원위치 재생성 */
  objectRespawn: (s: Phaser.Scene, x: number, y: number) => { playSound("objectRespawn", { x, y }); playEffect(s, "spawnSparkle", x, y); },
};
