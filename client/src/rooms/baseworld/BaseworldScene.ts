// baseworld 씬: 로컬 권위 아바타 + 고스트/몬스터 표현 + 자기화면 판정(§14) + serverview.
// Phaser는 렌더·입력만 (물리는 shared).
import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { getStateCallbacks } from "@colyseus/sdk";
import { TUNING, type Terrain, facesOf, createBody } from "shared/physics";
import "shared/behavior";
import "shared/properties";
import { compileRules, stepRules, type Ctx } from "shared/behavior";
import {
  type Avatar, type AvatarInput, createAvatar, stepAvatar, applyItem, clearItemEffects,
  pushSelfOut, checkIStomped, checkStompedMe, headStand,
  createCarryState, stepCarry, type CarryState, type Carryable,
  blockRect, type ItemSpec, type BlockSpec, type MonsterSpec,
} from "shared/parts";
import { getProperty } from "shared/properties";
import { TESTMAP } from "shared/maps";
import type { SceneWorld } from "./sceneWorld.js";
import {
  createGhostView, ghostServerUpdate, ghostStep, ghostSnapshot, ghostRenderAt, type GhostView,
} from "../../netphysics/interpolate.js";
import { sendAvatarState } from "../../netphysics/reconcile.js";
import { createSquash, setSquash, stepSquash, createSpring, stepSpring, type SquashState, type SpringState } from "../../netphysics/squash.js";
import { feedback, monsterPatternChanged } from "../../fx/dispatch.js";
import { screenShake } from "../../fx/juice.js";
import { unlockAudio } from "../../audio/zzfx.js";
import { setListenerPosition } from "../../audio/listener.js";
import { playSound } from "../../audio/sfx.js";
import { blockVisualTagsFromSpec, monsterVisualTagsFromSpec } from "shared/visual";
import { createSpriteView, destroySpriteView, assignManifest, stepSpriteView, getSpriteOutlineWorld, type SpriteView } from "../../sprites/view.js";
import { resolveAvatarAction, resolveMonsterAction } from "../../sprites/resolve.js";
import { fetchManifestByKey } from "../../sprites/registry.js";
import {
  flickerAlpha, squashedBox, revealAlpha, drawFaceBorders, drawSeamMergedBorders, type SeamRect,
  BORDER_WIDTH, drawPolyFaceBorders, drawSlopeBorder, drawPlayerBorder, drawSwitchTogglerBorder, drawSwitchAffectedBorder,
  drawItemGiverGlow, itemPulseScale,
  drawConveyorArrows, drawIceGlint, drawDashLines, drawBounceArrow, drawDirectionArrow,
  drawRideHint, drawDetectRing, drawCrumbleWarning, drawPeriodicWarning,
  drawHpPips, drawEnrageMark, drawShooterMark, drawSplitMark, drawImmortalMark,
} from "./visualLanguage.js";

const FIXED_MS = 1000 / TUNING.world.tickRate;

/** 블록 스펙 → 스프라이트 레지스트리 로컬 키(§sprites) — 시드 에셋 성격과 대응. 매핑 없으면 폴백. */
function blockLocalKey(spec: BlockSpec): string {
  if (spec.properties?.some((p) => p.type === "trampoline")) return "spring";
  if (spec.properties?.some((p) => p.type === "switchToggle")) return "switch";
  if (spec.properties?.some((p) => p.type === "damage")) return "spike";
  if (spec.switchReact) return "gate";
  if (spec.faces && spec.faces.top && !spec.faces.bottom) return "platform";
  return "ground";
}

interface View {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  ghost: GhostView;
  squash: SquashState;
  w: number; h: number;
  fxLeftMs: number;   // 연출 유예 (접촉 순간 끊김 시 깜빡임 방지)
  lastTick: number;   // 마지막으로 본 상대 tick (백그라운드=정지 감지용)
  lastTickAt: number; // tick이 마지막으로 오른 시각(ms)
  stale: boolean;     // 일정 시간 tick 정지 = 탭 백그라운드 → 충돌 통과(B)
  pound: number;      // 상대 내려찍기 상태 (넉백+스턴 판정용)
  ghostPushLeftMs: number;  // 상대-밀기(노이즈) 스무딩 잔여 — iPush(내 입력)는 즉시라 스무딩 안 함
  crouchSpring: SpringState;   // §B2 웅크림 스프라이트 스프링(축소·복원 띠용) — 원격 플레이어용
  spriteView: SpriteView;   // §sprites — 시트 준비 전엔 rect 폴백
}

export class BaseworldScene extends Phaser.Scene {
  room: Room;
  /** 씬이 소비하는 월드 — 기본 TESTMAP(콘솔 경로), 테스트/레이스는 mergeLines 결과 주입(2026-07-16 파라미터화). */
  world: SceneWorld;
  /** id → 스펙 조회 맵 — 핫루프(.find 반복)를 O(1)로. */
  blockSpecById: Map<string, BlockSpec>;
  monsterSpecById: Map<string, MonsterSpec>;
  itemSpecById: Map<string, ItemSpec>;
  me: Avatar;
  carry: CarryState = createCarryState();
  mySquash = createSquash();
  crouchSpring = createSpring(1);   // §B2 웅크림 스프라이트 스프링(축소·복원 띠용)
  tick = 0;
  acc = 0;
  sendAcc = 0;
  keys!: Record<"left" | "right" | "jump" | "down" | "run" | "grab", Phaser.Input.Keyboard.Key[]>;
  players = new Map<string, View>();
  monsters = new Map<string, View>();
  /** 몬스터 사운드/연출용 상태 전이 추적 (MonsterState 필드 엣지 감지 — 서버 emit이 클라에 직접 안 옴) */
  monsterFx = new Map<string, { alive: boolean; stunned: boolean; hidden: boolean; action: string }>();
  blockCrumbleFx = new Map<string, { crumbling: boolean; startAt: number }>();   // crumbling 전이 감지(사운드) + 시작시각(진행도 연출용)
  blockBumpFx = new Map<string, { squash: SquashState; untilMs: number }>();   // 물음표·스위치 블록 "띠용"(§B4)
  /** 다른 플레이어(고스트) 사운드용 상태 전이 추적 — PlayerState에 없는 필드(dead·wallJump)는 재현 불가(TODO) */
  playerFx = new Map<string, {
    grounded: boolean; slide: boolean; pound: number;
    clinging: boolean; dead: boolean; invincible: boolean; wallJumpSeq: number;
  }>();
  projectiles = new Map<string, Phaser.GameObjects.Rectangle>();
  itemRects = new Map<string, Phaser.GameObjects.Rectangle>();
  itemSprites = new Map<string, SpriteView>();     // §sprites — 아이템 kind별 시트, 준비 전엔 rect 폴백
  blockSprites = new Map<string, SpriteView>();    // §sprites — 블록 성격별 시트, 준비 전엔 rect 폴백
  itemSpawnAt = new Map<string, number>();   // 스폰 유예(§spawnGraceMs) — 나오자마자 바로 먹히는 것 방지
  carryRects = new Map<string, Phaser.GameObjects.Rectangle>();
  blockRects = new Map<string, Phaser.GameObjects.Rectangle>();
  // 보간 상태 (dead reckoning) — 모든 움직이는 것 (§21-1)
  projGhosts = new Map<string, GhostView>();
  carryGhosts = new Map<string, GhostView>();
  blockGhosts = new Map<string, GhostView>();
  // §A: 내가 밟고 있는(라이드 중인) 블록은 서버 왕복·고스트 보간을 기다리지 않고 로컬 직접 시뮬레이션.
  // 이유: 고스트(dead-reckoning+LERP)는 블록이 멈췄다 출발할 때 지연이 커서, 밟은 발판이 화면보다 늦게
  // 따라와 유저가 뚫고 지나가는 버그의 근본 원인이었음. 내가 타고 있는지는 순수 로컬 정보라 왕복 불필요.
  blockShadowRt = new Map<string, { x: number; y: number; mem: Record<string, number>; engaged: boolean }>();
  // 몬스터 로컬 타격 확정 (서버 왕복 안 기다림) — id → {예측 타격수, 시각}
  localMonHits = new Map<string, { count: number; at: number }>();
  myRect!: Phaser.GameObjects.Rectangle;
  mySpriteView!: SpriteView;   // §sprites — 매니페스트 준비 전엔 항상 폴백(myRect)이 보임
  handRect!: Phaser.GameObjects.Rectangle;
  debugGfx!: Phaser.GameObjects.Graphics;
  // 시각 언어(면별 테두리) — 두 레이어로 분리(피드백 2026-07-15: "스프라이트가 테두리보다 뒤에 있다").
  // groundVisualGfx: 지형·블록(자기 채움 위·엔티티 아래) — 캐릭터가 지나가면 자연스럽게 가림.
  // entityVisualGfx: 몬스터·플레이어(자기 몸 위) — 자기 사각형에 가려지면 안 보이므로 항상 위.
  visualGfx!: Phaser.GameObjects.Graphics;
  entityVisualGfx!: Phaser.GameObjects.Graphics;
  // serverview (§19): 주체 필터 + 옵션 1(스프라이트박스)/2(히트박스)/3(서버상태)
  svSubject: "all" | "player" | "terrain" | "monster" = "all";
  svOpts = new Set<number>();
  dead = false;
  deadUntil = 0;
  // 매크로 (§11 스펙): record → stop(확정) → play reset|loop
  macroState: "idle" | "recording" | "playing" = "idle";
  macroBuf: AvatarInput[] = [];
  macroIdx = 0;
  macroMode: "reset" | "loop" = "loop";
  macroStart = { x: 0, y: 0 };
  grabHighlightUntil = 0;
  monsterHitSeq = 0;
  // 자기 스프라이트 연출 (유예 포함): kind/dir/amount/남은ms
  selfFx = { kind: "none" as "none" | "stomped" | "shift" | "squeeze" | "ceil", dir: 1, amt: 8, left: 0, centered: false };
  prevGrounded = false;   // 착지·점프 전이 감지(사운드/이펙트)
  prevClinging = false;   // 벽 잡기(클링) 전이 감지
  prevSlide = false;      // 경사 슬라이딩 전이 감지
  prevSweepIndex = 0;     // 라인 파괴 스윕 전이 감지(레이스 전용 — RaceState.sweepIndex)

  constructor(room: Room, world: SceneWorld = TESTMAP) {
    super("baseworld");
    this.room = room;
    this.world = world;
    this.blockSpecById = new Map(world.blocks.map((b) => [b.id, b]));
    this.monsterSpecById = new Map(world.monsters.map((m) => [m.id, m]));
    this.itemSpecById = new Map(world.items.map((i) => [i.id, i]));
    this.me = createAvatar(world.spawn.x, world.spawn.y, TUNING.sizes.playerHeight);
  }

  /** 지연 큰 환경: join 직후 첫 상태 도착 전엔 스키마 맵이 undefined (§28 가드) */
  stateReady(): boolean {
    const s = this.room.state;
    return !!(s && s.players && s.blocks && s.monsters && s.items && s.projectiles && s.carryables);
  }

  // ── 지형 (동적 블록 반영) ──
  currentTerrain(): Terrain {
    const solids = [...this.world.terrain.solids];
    if (!this.room.state?.blocks) return { solids, slopes: this.world.terrain.slopes };
    this.room.state.blocks.forEach((bs: { x: number; y: number; active: boolean; visibleNow: boolean }, id: string) => {
      if (!bs.active || !bs.visibleNow) return;
      const spec = this.blockSpecById.get(id);
      if (!spec) return;
      const g = this.blockGhosts.get(id);   // 충돌도 보간 위치로 (렌더와 일치 → 라이딩 일관)
      const bx = g ? g.x : bs.x, by = g ? g.y : bs.y;
      solids.push({ x: bx, y: by, w: spec.w, h: spec.h, faces: spec.faces });
    });
    return { solids, slopes: this.world.terrain.slopes };
  }

  create(): void {
    const t = TUNING.world.tileSize;
    const worldTop = this.world.top ?? 0;
    const worldBottom = worldTop + this.world.height;
    // 격자 + 지형
    const grid = this.add.graphics().setDepth(-2);
    grid.lineStyle(1, 0xffffff, 0.06);
    for (let x = 0; x <= this.world.width; x += t) grid.lineBetween(x, worldTop, x, worldBottom);
    for (let y = worldTop; y <= worldBottom; y += t) grid.lineBetween(0, y, this.world.width, y);
    for (const s of this.world.terrain.solids) {
      this.add.rectangle(s.x, s.y, s.w, s.h, 0x555566).setOrigin(0, 0).setDepth(-1);
    }
    const slopeG = this.add.graphics().setDepth(-1);
    slopeG.fillStyle(0x555566, 1);
    for (const s of this.world.terrain.slopes) {
      if (s.dir === 1) slopeG.fillTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x + s.w, s.y);
      else slopeG.fillTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x, s.y);
    }
    // 깃발 (라인 경계 시각화)
    this.add.rectangle(this.world.line.startX + 8, this.world.spawn.y - 96, 8, 96, 0x44ff44).setOrigin(0, 0).setDepth(-1);
    this.add.rectangle(this.world.line.endX - 16, this.world.spawn.y - 96, 8, 96, 0xffd744).setOrigin(0, 0).setDepth(-1);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
      jump: [kb.addKey(K.SPACE), kb.addKey(K.UP), kb.addKey(K.W)],
      down: [kb.addKey(K.DOWN), kb.addKey(K.S)],
      run: [kb.addKey(K.SHIFT)],
      grab: [kb.addKey(K.K)],
    };
    kb.disableGlobalCapture();
    // 오디오 자동재생 정책: 첫 제스처에서 해제
    this.input.keyboard!.once("keydown", unlockAudio);
    this.input.once("pointerdown", unlockAudio);

    // 내 아바타
    this.myRect = this.add.rectangle(0, 0, this.me.body.w, this.me.body.h, 0x4488ff).setOrigin(0.5, 1).setDepth(5);
    this.mySpriteView = createSpriteView(this, 5);
    this.loadAvatarSprite();
    this.handRect = this.add.rectangle(0, 0, 14, 14, 0xffffff).setDepth(6).setVisible(false);
    this.debugGfx = this.add.graphics().setDepth(20);
    this.visualGfx = this.add.graphics().setDepth(2.5);       // 블록(2) 위, 아이템·엔티티(3~5) 아래
    this.entityVisualGfx = this.add.graphics().setDepth(5.5); // 몬스터·플레이어(4~5) 전부 위

    const $ = getStateCallbacks(this.room);
    // 스위치 토글(§B3): 라인 전역 발동이므로 모든 클라(관련 없는 라인도 포함, 라인 1개짜리 맵이라 전원)가 화면 흔들림으로 체감
    $(this.room.state).listen("switchOn", () => { screenShake(this, 120, 0.0035); });
    // 고스트 플레이어
    // 모든 onAdd에서 새로 만들기 전에 기존 걸 파괴 — 재연결·씬 재시작 등으로 onAdd가 같은 id에
    // 두 번 불리면(Colyseus는 콜백 등록 시점에 기존 항목 전부에 대해서도 onAdd를 쏨) 이전 오브젝트가
    // 고아로 남아 화면에 계속 보이는 버그가 있었음(2026-07-16 피드백: "물리판정은 없어지는데 스프라이트는 남음").
    $(this.room.state).players.onAdd((p: PlayerNet, id: string) => {
      if (id === this.room.sessionId) return;
      this.dropView(this.players, id);
      const v = this.makeView(p.x, p.y, p.w, p.h, 0xff5555, p.nickname || id.slice(0, 4));
      this.assignSpriteByKey(v.spriteView, "avatar");
      this.players.set(id, v);
    });
    $(this.room.state).players.onRemove((_p: PlayerNet, id: string) => { this.dropView(this.players, id); this.playerFx.delete(id); });
    // 몬스터
    $(this.room.state).monsters.onAdd((m: MonsterNet, id: string) => {
      this.dropView(this.monsters, id);
      const v = this.makeView(m.x, m.y, m.w, m.h, 0xcc66ff, m.asset);
      this.assignSpriteByKey(v.spriteView, m.asset);
      this.monsters.set(id, v);
    });
    $(this.room.state).monsters.onRemove((_m: MonsterNet, id: string) => { this.dropView(this.monsters, id); this.monsterFx.delete(id); });
    // 발사체
    $(this.room.state).projectiles.onAdd((pr: ProjNet, id: string) => {
      this.projectiles.get(id)?.destroy();
      this.projectiles.set(id, this.add.rectangle(pr.x, pr.y, TUNING.sizes.projectile, TUNING.sizes.projectile, 0xffaa33).setOrigin(0.5, 1).setDepth(4));
    });
    $(this.room.state).projectiles.onRemove((pr: ProjNet, id: string) => {
      this.projectiles.get(id)?.destroy();
      this.projectiles.delete(id);
      this.projGhosts.delete(id);
      feedback.projectileHit(this, pr.x, pr.y);
    });
    // 아이템
    $(this.room.state).items.onAdd((it: ItemNet, id: string) => {
      this.itemRects.get(id)?.destroy();
      this.itemRects.set(id, this.add.rectangle(it.x, it.y, TUNING.sizes.item, TUNING.sizes.item, 0x66ffcc).setOrigin(0.5, 1).setDepth(3));
      const sv = this.itemSprites.get(id);
      if (sv) destroySpriteView(sv);
      const view = createSpriteView(this, 3);
      this.assignSpriteByKey(view, it.kind);
      this.itemSprites.set(id, view);
      // 스폰 유예(§spawnGraceMs, 2026-07-16): 물음표 블록에서 막 나온 아이템이 스폰 위치와 겹쳐
      // 있는 플레이어에게 그 자리에서 바로(같은 프레임 수준으로) 먹혀버려 "나오자마자 사라져서
      // 먹은 건지도 모르겠다"는 피드백 — 원작처럼 잠깐 뜬 걸 보여준 다음에야 먹을 수 있게 함.
      this.itemSpawnAt.set(id, this.time.now);
    });
    // 잡기 파츠 (돌)
    $(this.room.state).carryables.onAdd((c: CarryNet, id: string) => {
      this.carryRects.get(id)?.destroy();
      this.carryRects.set(id, this.add.rectangle(c.x, c.y, TUNING.sizes.carryable, TUNING.sizes.carryable, 0xb08850).setOrigin(0.5, 1).setDepth(3));
    });
    // 잡기 거부 (서버 소유권 패배 §30-4) — 손에서 사라짐, 이전 행동 원복 없음
    this.room.onMessage("grabDenied", (m: { objId: string }) => {
      if (this.carry.heldId === m.objId) this.carry.heldId = null;
      feedback.grabDenied(this, this.me.body.x, this.me.body.y);
    });
    // 블록
    $(this.room.state).blocks.onAdd((bs: BlockNet, id: string) => {
      const spec = this.blockSpecById.get(id);
      if (!spec) return;
      this.blockRects.get(id)?.destroy();
      this.blockRects.set(id, this.add.rectangle(bs.x, bs.y, spec.w, spec.h, 0x888888).setOrigin(0, 0).setDepth(2));
      const sv = this.blockSprites.get(id);
      if (sv) destroySpriteView(sv);
      const view = createSpriteView(this, 2);
      this.assignSpriteByKey(view, blockLocalKey(spec));
      this.blockSprites.set(id, view);
    });
    // 아이템 획득 중재 결과 (§60)
    this.room.onMessage("itemClaim", (m: { itemId: string; winner: string | null }) => {
      if (m.winner === this.room.sessionId) {
        const spec = this.itemSpecById.get(m.itemId)
          ?? ({ id: m.itemId, kind: this.room.state.items.get(m.itemId)?.kind ?? "speed", x: 0, y: 0 } as ItemSpec);
        applyItem(this.me, spec);
        feedback.pickup(this, this.me.body.x, this.me.body.y, spec.kind);
      }
    });
    this.room.onMessage("tp", (m: { sessionId: string; x: number; y: number }) => {
      if (m.sessionId === this.room.sessionId) { this.me.body.x = m.x; this.me.body.y = m.y; }
    });
    // 추락사 리스폰 통지(RaceRoom/TestLineRoom 공용 — RACE_S2C_MSG.respawnAt과 TESTLINE_MSG.respawnAt 둘 다 "respawnAt")
    this.room.onMessage("respawnAt", (m: { x: number; y: number }) => {
      this.me.body.x = m.x; this.me.body.y = m.y; this.me.body.vx = 0; this.me.body.vy = 0;
    });

    this.cameras.main.setBounds(0, this.world.top ?? 0, this.world.width, this.world.height);
    this.cameras.main.startFollow(this.myRect, true, 0.15, 0.15);
  }

  /** 기본 아바타 매니페스트 조회(§sprites) — 시스템 에셋에 시트가 아직 없으면(404/actions 빈 응답)
   *  조용히 실패하고 폴백(myRect 사각형)을 계속 쓴다. 게임 진행을 절대 막지 않는다. */
  private loadAvatarSprite(): void {
    this.assignSpriteByKey(this.mySpriteView, "avatar");
  }

  makeView(x: number, y: number, w: number, h: number, color: number, name: string): View {
    return {
      rect: this.add.rectangle(x, y, w, h, color).setOrigin(0.5, 1).setDepth(4),
      label: this.add.text(x, y - h - 14, name, { fontSize: "12px", color: "#fff" }).setOrigin(0.5, 1).setDepth(5),
      ghost: createGhostView(x, y),
      squash: createSquash(),
      w, h,
      fxLeftMs: 0,
      lastTick: -1, lastTickAt: 0, stale: false,
      pound: 0, ghostPushLeftMs: 0,
      crouchSpring: createSpring(1),
      spriteView: createSpriteView(this, 4),
    };
  }
  dropView(map: Map<string, View>, id: string): void {
    const v = map.get(id);
    v?.rect.destroy(); v?.label.destroy();
    if (v) destroySpriteView(v.spriteView);
    map.delete(id);
  }

  /** 로컬 키(몬스터 asset명·아이템 kind 등)로 매니페스트를 찾아 SpriteView에 배정(§sprites).
   *  매핑 없음·미준비·실패는 전부 무시 — 폴백(사각형) 유지. */
  private assignSpriteByKey(view: SpriteView, localKey: string): void {
    fetchManifestByKey(localKey).then((m) => {
      if (m && view.sprite.active) assignManifest(this, view, m);
    });
  }

  update(_time: number, delta: number): void {
    this.acc += delta;
    while (this.acc >= FIXED_MS) { this.acc -= FIXED_MS; this.fixedTick(); }
    this.render(delta);
  }

  held(k: keyof BaseworldScene["keys"]): boolean {
    return this.keys[k].some((key) => key.isDown);
  }

  /** 몬스터 유효 타격수 = 서버값과 내 로컬 예측(2초 유효) 중 큰 값 (로컬 확정) */
  monEffHits(id: string, serverHits: number): number {
    const e = this.localMonHits.get(id);
    return e && this.time.now - e.at < 2000 ? Math.max(serverHits, e.count) : serverHits;
  }

  /** 내 발이 지금 이 블록 윗면에 있는가 (§A 라이드 판정). 2026-07-16 피드백: "너무 안 좋고 자꾸
   *  내려간다" — grounded 스냅(±6px) 요구가 너무 빡빡해서 캐리가 안 붙는 틈이 있었음. grounded를
   *  필수로 안 두고, 발이 윗면 근방(위로 좀 더 널널, 아래로도 여유)에 있으면 라이드로 인정. */
  private isRidingBlock(bx: number, by: number, spec: BlockSpec): boolean {
    const b = this.me.body;
    const withinX = Math.abs(b.x - (bx + spec.w / 2)) < (b.w + spec.w) / 2;
    return withinX && b.y >= by - 14 && b.y <= by + 20;
  }

  /** 이동 발판 보간 전진: 충돌(currentTerrain)·렌더가 같은 위치를 쓰도록 fixedTick에서 갱신 */
  stepBlockGhosts(): void {
    if (!this.room.state?.blocks) return;
    this.room.state.blocks.forEach((bs: BlockNet, id: string) => {
      let g = this.blockGhosts.get(id);
      if (!g) { g = createGhostView(bs.x, bs.y); this.blockGhosts.set(id, g); }
      if (bs.x !== g.srvX || bs.y !== g.srvY) ghostServerUpdate(g, bs.x, bs.y, bs.vx, bs.vy); // 새 패치만
      ghostStep(g, FIXED_MS, TUNING.net.monsterLerp);

      // §A: 내가 밟고 있으면 고스트 대신 로컬 stepRules 결과로 대체(서버와 동일 규칙, 지연 없음)
      const spec = this.blockSpecById.get(id);
      if (!spec?.rules || !bs.active) { this.blockShadowRt.delete(id); return; }
      let sh = this.blockShadowRt.get(id);
      if (!sh) { sh = { x: g.x, y: g.y, mem: {}, engaged: false }; this.blockShadowRt.set(id, sh); }
      const riding = this.isRidingBlock(sh.engaged ? sh.x : g.x, sh.engaged ? sh.y : g.y, spec);
      if (!riding) { sh.engaged = false; return; }
      if (!sh.engaged) { sh.x = g.x; sh.y = g.y; sh.engaged = true; }   // 라이드 시작 순간=서버 위치에서 이어받음
      const prevX = sh.x, prevY = sh.y;   // §A-캐리: 이번 틱 이동량 계산용
      const motionOk = !spec.switchReact || spec.switchReact.mode !== "motion"
        || this.room.state.switchOn === spec.switchReact.whenOn;
      if (motionOk) {
        const body = createBody(sh.x + spec.w / 2, sh.y + spec.h, spec.w, spec.h, ["block"]);
        body.gravity = false;
        body.facing = (sh.mem["__facing"] ?? 1) as 1 | -1;
        const emptyMem = sh.mem as unknown as Record<string, unknown>;
        let compiled = emptyMem["__compiled"] as unknown as ReturnType<typeof compileRules> | undefined;
        if (!compiled) { compiled = compileRules(spec.rules); emptyMem["__compiled"] = compiled as unknown as number; }
        const ctx: Ctx = {
          self: body, dtMs: FIXED_MS, t: TUNING, terrain: this.currentTerrain(),
          players: [this.me.body], target: null, rng: Math.random,
          mem: sh.mem, events: new Set(), emit: () => {},
          switchOn: this.room.state.switchOn, hpRatio: 1,
        };
        stepRules(compiled, ctx);
        body.x += body.vx * (FIXED_MS / 1000);
        body.y += body.vy * (FIXED_MS / 1000);
        sh.mem["__facing"] = body.facing;
        sh.x = body.x - spec.w / 2;
        sh.y = body.y - spec.h;
      }
      // §A-캐리: 발판이 이번 틱 이동한 만큼 위에 탄 나도 리지드하게 같이 옮김.
      // 이게 없으면 중력이 나를 끌어내리는 동안 발판만 앞서 움직여서(특히 위로) 발밑을 뚫고 지나가 버린다 —
      // 지연(고스트 랙) 제거만으로는 못 고치는, 애초에 "캐리" 개념 자체가 없었던 게 진짜 원인.
      this.me.body.x += sh.x - prevX;
      this.me.body.y += sh.y - prevY;
      g.x = sh.x; g.y = sh.y;
      // 고스트의 내부 외삽 목표(lastX/Y)도 같이 붙여둔다 — 안 그러면 라이드 중 계속 자기 혼자 dead
      // reckoning으로 딴 곳을 향해 표류하다가, 내려서는 순간 거기로 확 튀는("점프하면 원위치로 복귀")
      // 버그가 생긴다(2026-07-16 피드백). 라이드 끝나도 다음 ghostStep이 이미 같은 지점이라 안 튐.
      g.lastX = sh.x; g.lastY = sh.y;
    });
  }

  fixedTick(): void {
    if (!this.stateReady()) return;   // 첫 상태 도착 전 스킵 (§28)
    this.tick++;
    this.stepBlockGhosts();           // 죽어도 발판은 계속 움직여야 하므로 dead 체크 앞
    const now = this.time.now;
    if (this.dead) {
      if (now >= this.deadUntil) this.respawn();
      return;
    }
    let input: AvatarInput = {
      left: this.held("left"), right: this.held("right"),
      jump: this.held("jump"), down: this.held("down"),
      run: this.held("run"), grab: this.held("grab"), tick: this.tick,
    };
    // ── 매크로: 녹화 = 실제 입력 기록 / 재생 = 버퍼 입력으로 대체 (§11) ──
    if (this.macroState === "recording") {
      this.macroBuf.push({ ...input });
    } else if (this.macroState === "playing" && this.macroBuf.length > 0) {
      if (this.macroIdx >= this.macroBuf.length) {
        this.macroIdx = 0;
        if (this.macroMode === "reset") {
          // 위치·능력 전부 초기화 (로컬 권위라 서버 동기화 불필요 — relay가 전파)
          this.me = createAvatar(this.macroStart.x, this.macroStart.y, TUNING.sizes.playerHeight);
        }
      }
      input = { ...this.macroBuf[this.macroIdx++], tick: this.tick };
    }
    const terrain = this.currentTerrain();
    const b = this.me.body;
    const prevVy = b.vy;
    const prevPound = this.me.pound;
    const prevBottomY = b.y;   // 스윕 밟기 판정용(직전 발 위치)

    stepAvatar(this.me, input, FIXED_MS, terrain);

    // ── 사운드/이펙트 배선: 착지·점프 전이 ──
    if (b.grounded && !this.prevGrounded) {
      // 내려찍기 착지는 일반 착지보다 무거운 임팩트로 대체(둘 다 안 겹치게)
      if (this.me.fx.has("poundLand")) feedback.poundLand(this, b.x, b.y);
      else feedback.land(this, b.x, b.y);
    } else if (!b.grounded && this.prevGrounded && b.vy < 0) {
      feedback.jump(this, b.x, b.y);
    }
    this.prevGrounded = b.grounded;

    // ── 사운드/이펙트: 벽 잡기(클링) 전이 ──
    const clinging = !b.grounded && b.touchingWall !== 0;
    if (clinging && !this.prevClinging) feedback.wallGrab(this, b.x, b.y);
    this.prevClinging = clinging;

    // ── 사운드/이펙트: 경사 슬라이딩 전이 ──
    if (this.me.slide && !this.prevSlide) feedback.slideStart(this, b.x, b.y);
    this.prevSlide = this.me.slide;

    // ── PvP: 자기 화면 판정 (§14) ──
    const GRACE = TUNING.push.visualGraceMs;
    // 정지(백그라운드) 고스트는 밀기·밟기·서기 판정에서 제외 = 충돌 통과 (B)
    const ghostViews = [...this.players.values()].filter((v) => !v.stale);
    // 판정 = 화면과 동일한 "지연 보간 위치"(g.x/g.y). 보는 대로 맞음 + 과거 실제 위치라 뚫기 없음
    const ghosts = ghostViews.map((v) => ({
      x: v.ghost.x, y: v.ghost.y, w: v.w, h: v.h, vy: v.ghost.lastVy, pound: v.pound,
    }));
    // 유예 감쇠: 접촉이 순간 끊겨도 GRACE 동안 연출 유지 (깜빡임 방지)
    for (const v of ghostViews) {
      v.fxLeftMs = Math.max(0, v.fxLeftMs - FIXED_MS);
      if (v.fxLeftMs <= 0) setSquash(v.squash, "none");
    }
    this.selfFx.left = Math.max(0, this.selfFx.left - FIXED_MS);
    // 밀기 판정 사전 계산 — fix1: iPush(내 입력)는 즉시, ghostPush(relay 속도)는 노이즈라 스무딩
    const RATIO = TUNING.push.squeezeRatio;
    const pushInfo = ghosts.map((g, i) => {
      const v = ghostViews[i];
      const dirToGhost = g.x >= b.x ? 1 : -1;
      const contact = Math.abs(g.x - b.x) < (g.w + b.w) / 2 + TUNING.push.contactPad
        && g.y > b.y - b.h && g.y - g.h < b.y;
      const iPush = (input.right && dirToGhost === 1) || (input.left && dirToGhost === -1);
      const ghostPushInst = Math.abs(v.ghost.lastVx) > TUNING.push.velThreshold
        && Math.sign(v.ghost.lastVx) === -dirToGhost;
      if (ghostPushInst) v.ghostPushLeftMs = GRACE;
      else v.ghostPushLeftMs = Math.max(0, v.ghostPushLeftMs - FIXED_MS);
      return { dirToGhost, contact, iPush, ghostPush: v.ghostPushLeftMs > 0 };
    });
    // 밀기: 겹친 만큼 내 몸만 소프트 상한으로 빠져나옴(원본). 밀기는 겹침 기반(상대 클라가 처리)
    pushSelfOut(b, ghosts);
    const pounding = this.me.pound !== 0;
    const stompedIdx = checkIStomped(this.me, ghosts, TUNING, pounding, prevBottomY);
    if (stompedIdx >= 0) {
      this.me.fx.add("stompedOther");
      setSquash(ghostViews[stompedIdx].squash, "stomped");   // 밟힌 상대 찌부 (내 화면)
      ghostViews[stompedIdx].fxLeftMs = GRACE;
      feedback.headstompAttacker(this, ghosts[stompedIdx].x, ghosts[stompedIdx].y);
      if (this.me.pound !== 0) {
        // B: 내려찍기로 플레이어 밟음 → 큰 바운스 + 내려찍기 종료 (강화점프 창은 checkIStomped가 이미 설정)
        b.vy = TUNING.stomp.poundBounceVelocity;
        this.me.pound = 0;
      }
    }
    const stompedMe = checkStompedMe(this.me, ghosts);
    if (stompedMe) feedback.headstompVictim(this, b.x, b.y);
    headStand(b, ghosts);
    // 아래→위 충돌: 상승 중 상대 몸 밑면에 머리 박음 = 천장 판정(마리오식) → 상승 취소 + 천장 연출
    if (b.vy < 0) {
      const headY = b.y - b.h;
      for (const g of ghosts) {
        const hOv = Math.min(b.x + b.w / 2, g.x + g.w / 2) - Math.max(b.x - b.w / 2, g.x - g.w / 2);
        if (hOv <= b.w * 0.3) continue;
        if (headY <= g.y && headY >= g.y - TUNING.stomp.headBandPx) {
          b.vy = 0; b.y = g.y + b.h;      // 머리를 상대 밑면에 붙이고 상승 정지
          this.me.fx.add("ceilBonk");
          break;
        }
      }
    }
    // 밀기 연출 (§26): 밀리는 쪽=squeeze(접촉면 찌부), 미는 쪽=shift. iPush 즉시/ghostPush 스무딩(fix1)
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      const v = ghostViews[i];
      const { contact, iPush, ghostPush, dirToGhost: dir } = pushInfo[i];
      if (!contact || (!iPush && !ghostPush)) continue;
      if (iPush && ghostPush) {
        // 맞밀기: 양쪽에서 눌림 → 중앙 대칭 찌부(폭 0 → offset 0). 나·상대 둘 다
        setSquash(v.squash, "squeeze", dir, RATIO, 0);
        v.fxLeftMs = GRACE;
        this.selfFx = { kind: "squeeze", dir: -dir, amt: RATIO, left: GRACE, centered: true };
      } else if (iPush) {
        setSquash(v.squash, "squeeze", dir, RATIO, g.w);   // 상대=접촉면 찌부
        v.fxLeftMs = GRACE;
        this.selfFx = { kind: "shift", dir, amt: g.w * RATIO, left: GRACE, centered: false };  // 나=파고드는 shift
      } else {   // ghostPush
        setSquash(v.squash, "shift", -dir, b.w * RATIO);   // 상대=shift
        v.fxLeftMs = GRACE;
        this.selfFx = { kind: "squeeze", dir: -dir, amt: RATIO, left: GRACE, centered: false };  // 나=접촉면 찌부
      }
    }
    // 자기 스프라이트 연출 (우선순위: 밟힘 > 천장 > shift 유예)
    if (stompedMe) { this.selfFx = { kind: "stomped", dir: 1, amt: 0, left: GRACE, centered: false }; }
    else if (this.me.fx.has("ceilBonk")) {
      this.selfFx = { kind: "ceil", dir: 1, amt: 0, left: GRACE, centered: false };
      feedback.ceilBonk(this, b.x, b.y - b.h);
    }
    if (this.selfFx.left > 0) {
      if (this.selfFx.kind === "shift") setSquash(this.mySquash, "shift", this.selfFx.dir, this.selfFx.amt);
      else if (this.selfFx.kind === "squeeze") setSquash(this.mySquash, "squeeze", this.selfFx.dir, this.selfFx.amt || TUNING.push.squeezeRatio, this.selfFx.centered ? 0 : b.w);
      else setSquash(this.mySquash, this.selfFx.kind === "none" ? "none" : this.selfFx.kind);
    } else {
      setSquash(this.mySquash, "none");
    }

    // ── 몬스터: 자기 화면 판정 ──
    for (const v of this.monsters.values()) setSquash(v.squash, "none");
    this.room.state.monsters.forEach((m: MonsterNet, id: string) => {
      const effHits = this.monEffHits(id, m.hitCount);
      if (!m.alive || m.hidden || effHits >= m.hp) return;   // 로컬 확정 사망도 즉시 제외
      if (this.room.state.serverTime < m.graceEndsAt) return;   // 재생성 유예 중엔 접촉·타격 상호작용 없음
      const v = this.monsters.get(id);
      const mx = v ? v.ghost.x : m.x, my = v ? v.ghost.y : m.y;   // 판정=화면과 동일한 지연 보간 위치
      // 밟기 가로 판정만 확대(일반 ×reachH, 내려찍기 ×poundReachH), 데미지 히트박스는 기본 폭. 세로 불변
      const hMult = prevPound === 2 ? TUNING.stomp.poundReachH : TUNING.stomp.reachH;
      const halfWs = (b.w * hMult) / 2;
      const hOvStomp = Math.min(b.x + halfWs, mx + m.w / 2) - Math.max(b.x - halfWs, mx - m.w / 2);
      // 옆 대미지 판정은 기본 폭보다 살짝 좁게(§B2) — 애매하게 걸치는 경우 밟기(hOvStomp, 위에서 별도 처리)가 우선되게 함
      const halfWd = (b.w * 0.8) / 2;
      const hOvBase = Math.min(b.x + halfWd, mx + m.w / 2) - Math.max(b.x - halfWd, mx - m.w / 2);
      const vOv = Math.min(b.y, my) - Math.max(b.y - b.h, my - m.h);
      if (hOvStomp <= 0 || vOv <= 0) return;
      // A: 위에서 내려오면 확실히 밟기(데미지 없음). fromAbove(현재 상반부) OR 스윕(직전엔 머리 위, 지금 통과)
      const descending = prevVy > 0 || prevPound === 2;
      const monsterTop = my - m.h;
      const fromAbove = b.y <= my - m.h * 0.5;
      const crossed = prevBottomY <= monsterTop && b.y >= monsterTop;  // 빠른 낙하 터널링도 잡음
      if (descending && (fromAbove || crossed)) {
        const willKill = effHits + 1 >= m.hp;
        this.localMonHits.set(id, { count: effHits + 1, at: this.time.now });   // 로컬 즉시 확정
        this.room.send("hitMonster", { monsterId: id, hitId: `h${this.monsterHitSeq++}` });
        if (v) setSquash(v.squash, "stomped");
        feedback.stomp(this, mx, my);
        if (prevPound === 2 && willKill) {
          // 내려찍기로 죽임 → 원작대로 튕김 없이 flatten(pound가 계속 내려감)
        } else if (prevPound === 2) {
          // B2: 내려찍었는데 안 죽음 → 큰 바운스 + 강화점프 창 + 내려찍기 종료 (스핀 없음)
          b.vy = TUNING.stomp.poundBounceVelocity;
          this.me.stompComboLeftMs = TUNING.stomp.jumpWindowMs;
          this.me.pound = 0;
        } else {
          // 일반 밟기 → 튕김 + 강화점프 창
          b.vy = TUNING.stomp.bounceVelocity;
          this.me.stompComboLeftMs = TUNING.stomp.jumpWindowMs;
        }
      } else if (hOvBase > 0 && this.me.slide) {
        // 경사 슬라이드로 접촉 → 처치(원작 Slide Attack), 접촉 데미지 무적(발사체는 별개)
        this.localMonHits.set(id, { count: effHits + 1, at: this.time.now });
        this.room.send("hitMonster", { monsterId: id, hitId: `h${this.monsterHitSeq++}` });
        if (v) setSquash(v.squash, "stomped");
      } else if (hOvBase > 0 && this.me.invincibleLeftMs > 0) {
        this.localMonHits.set(id, { count: effHits + 1, at: this.time.now });
        this.room.send("hitMonster", { monsterId: id, hitId: `h${this.monsterHitSeq++}` });
      } else if (hOvBase > 0) {
        // contactDamage/shove는 스펙에서(테스트맵 밖 스폰 몬스터는 기본 T/F) — 이전엔 항상 피해였음
        const spec = this.monsterSpecById.get(id);
        const contactDamage = spec?.contactDamage ?? true;
        const shove = spec?.shove ?? false;
        if (shove) {
          // 무해 넉백(§shove) — 상대 위치 기준 밀어냄, 피해 없음
          b.vx = Math.sign(b.x - mx || 1) * TUNING.item.knockbackVx;
          b.vy = TUNING.item.knockbackVy;
        } else if (contactDamage) {
          // 데미지는 기본 폭 겹침일 때만. 방금 밟은 몬스터면 튕겨 분리되는 짧은 창엔 무시(재접촉 방지)
          const e = this.localMonHits.get(id);
          if (e && this.time.now - e.at < 400) return;
          this.takeHit(); // 접촉 피해 = 자기 클라 확정
        }
      }
    });

    // ── 발사체 피격 (자책 방지 §30-1) ──
    this.room.state.projectiles.forEach((pr: ProjNet, _id: string) => {
      if (pr.ownerId === this.room.sessionId && this.carry.selfIgnoreLeftMs > 0) return;
      const hOv = Math.abs(pr.x - b.x) < (TUNING.sizes.projectile + b.w) / 2;
      const vOv = pr.y > b.y - b.h && pr.y - TUNING.sizes.projectile < b.y;
      if (hOv && vOv && this.me.invincibleLeftMs <= 0) {
        if (pr.effect === "knockback") { b.vx = Math.sign(b.x - pr.x) * TUNING.item.knockbackVx; b.vy = TUNING.item.knockbackVy; }
        else this.takeHit();
      }
    });

    // ── 블록 상호작용: 머리치기/내려찍기 파괴·물음표·물성 ──
    this.room.state.blocks.forEach((bs: BlockNet, id: string) => {
      const spec = this.blockSpecById.get(id);
      if (!spec || !bs.active || !bs.visibleNow) return;
      const g = this.blockGhosts.get(id);   // 상호작용도 보간 위치로 (충돌과 일치)
      const bx = g ? g.x : bs.x, by = g ? g.y : bs.y;
      const r = blockRect({ spec, x: bx, y: by, state: "active", respawnLeftMs: 0, graceLeftMs: 0, emptied: bs.emptied, mem: {} });
      const withinX = Math.abs(b.x - (r.x + r.w / 2)) < (b.w + r.w) / 2;
      const headAt = b.y - b.h;
      const blockTop = r.y, blockBottom = r.y + r.h;
      // 겹침 기반(§B1): 정확히 면에 닿지 않아도 조금이라도 걸치면 인정(마리오 원작 방식). 거리기반(±10/12px) 대신 블록 세로 구간과의 겹침으로 판정.
      // 2026-07-16: ±2px는 여전히 빡빡하다는 피드백 — ±6px로 완화. + ceilBonk(같은 틱에 점프가 천장에
      // 즉시 막힌 경우, avatar.ts) 도 인정 — 클리어런스가 좁은 블록은 물리가 vy를 같은 틱에 0으로
      // 꺾어버려서 prevVy<0 시점을 못 잡는 경우가 있었음(디버그로 실제 확인, sw1이 그 사례).
      const bonkHead = withinX && (prevVy < 0 || this.me.fx.has("ceilBonk")) && headAt <= blockBottom + 6 && headAt >= blockTop - 6;
      const poundOn = withinX && prevPound === 2 && b.y >= blockTop - 6 && b.y <= blockBottom + 6;
      // 물음표는 머리치기·내려찍기 둘 다로 발동(2026-07-16: 내려찍기 쪽이 빠져 있었음)
      if ((bonkHead || poundOn) && spec.emitsItem && !bs.emptied) {
        this.room.send("hitQBlock", { blockId: id, by: bonkHead ? "headbutt" : "pound" });
      }
      if (bonkHead && spec.breakBy?.headbutt) this.room.send("breakBlock", { blockId: id, by: "headbutt" });
      if (poundOn && spec.breakBy?.pound) this.room.send("breakBlock", { blockId: id, by: "pound" });
      // 스위치 토글: 아이템 블록과 동일하게 "아래에서 치거나 내려찍었을 때"만 발동(2026-07-15 통일).
      // 이전엔 접촉(onTouch)으로 처리해 닿아 있는 매 틱마다 토글이 재전송되는 버그가 있었음.
      const isSwitchToggler = spec.properties?.some((p) => p.type === "switchToggle");
      if ((bonkHead || poundOn) && isSwitchToggler) {
        this.room.send("toggleSwitch", {});
        feedback.toggleSwitch(this, this.me.body.x, this.me.body.y);
      }
      // 물음표·스위치 블록 "띠용"(§B4): 히트박스는 그대로, 스프라이트만 충격 반대방향으로 잠깐 이동
      if ((bonkHead || poundOn) && (spec.emitsItem || isSwitchToggler)) {
        let fx = this.blockBumpFx.get(id);
        if (!fx) { fx = { squash: createSquash(), untilMs: 0 }; this.blockBumpFx.set(id, fx); }
        setSquash(fx.squash, "bumpY", bonkHead ? -1 : 1, 10);
        fx.untilMs = this.time.now + 130;
      }
      // 물성 (당하는 쪽 로컬 적용 §properties) — switchToggle은 위에서 별도 처리(더 이상 onTouch 없음)
      if (spec.properties) {
        const blockTop = r.y, blockBottom = r.y + r.h;
        const touching = withinX && b.y >= blockTop - 2 && b.y - b.h <= blockBottom + 2;
        // §B5: 정확히 grounded+4px 스냅이 아니라 겹침·스윕 기반으로 완화(몬스터 stomp·블록 bonk/pound와 통일).
        // 직전엔 블록 위였는데 지금 닿았으면(대각선 착지 등 grounded 갱신이 한 틱 늦는 경우) 도 top으로 인정.
        const landedOnTop = prevBottomY <= blockTop + 4 && b.y >= blockTop - 4;
        const standing = withinX && b.y >= blockTop - 4 && b.y <= blockTop + 8 && (b.grounded || landedOnTop);
        for (const propSpec of spec.properties) {
          const impl = getProperty(propSpec.type);
          if (!impl) continue;
          if (standing && impl.onStand) impl.onStand(b, TUNING, propSpec);
          if (touching && impl.onTouch) {
            const side = standing ? "top" : bonkHead ? "bottom" : b.x < r.x + r.w / 2 ? "right" : "left";
            if (propSpec.type === "trampoline" && side === "top") feedback.spring(this, r.x + r.w / 2, r.y);
            impl.onTouch(b, r, side, TUNING, propSpec);
          }
        }
      }
    });
    // 물성 부수효과 플래그 소비 (switchToggle은 더 이상 여기 없음 — bonk/pound 직접 처리로 이동)
    const flags = b as unknown as { __takeDamage?: boolean; __die?: boolean };
    if (flags.__die) { flags.__die = false; this.die(); }
    if (flags.__takeDamage) { flags.__takeDamage = false; this.takeHit(); }

    // ── 아이템 접촉 → 서버 경합 (§60) ──
    this.room.state.items.forEach((it: ItemNet, id: string) => {
      if (!it.available) return;
      // 스폰 유예: 막 나온 아이템은 잠깐 보여준 뒤에야 먹을 수 있음(§spawnGraceMs, 2026-07-16)
      const spawnedAt = this.itemSpawnAt.get(id);
      if (spawnedAt !== undefined && this.time.now - spawnedAt < TUNING.item.spawnGraceMs) return;
      if (Math.abs(it.x - b.x) < (TUNING.sizes.item + b.w) / 2 && Math.abs(it.y - b.y) < b.h) {
        this.room.send("claimItem", { itemId: id });
      }
    });

    // ── 잡기 (§30): 로컬 즉시 잡기 + 서버 소유권 통지 ──
    const carryables: Carryable[] = [];
    this.room.state.carryables.forEach((c: CarryNet, id: string) => {
      if (!c.alive) return;
      const cb = { x: c.x, y: c.y, vx: 0, vy: 0, w: TUNING.sizes.carryable, h: TUNING.sizes.carryable, grounded: true, facing: 1 as const, touchingWall: 0 as const, onSlopeDir: 0 as const, gravity: true, tags: [] };
      carryables.push({ id, body: cb, grabbable: true, heldBy: c.heldBy || null });
    });
    const ev = stepCarry(this.carry, this.me, input, carryables);
    if (ev.kind === "grabMiss") { this.grabHighlightUntil = now + 800; feedback.grabDenied(this, b.x, b.y); }
    else if (ev.kind === "grab" && ev.id) { this.room.send("grabObj", { objId: ev.id }); feedback.grab(this, b.x, b.y); }
    else if (ev.kind === "throw" && ev.id) {
      this.room.send("throwObj", {
        objId: ev.id,
        x: b.x + b.facing * (b.w / 2 + TUNING.sizes.handOffset), y: b.y - b.h * 0.5,
        vx: ev.vx ?? 0, vy: ev.vy ?? 0,
      });
      playSound("throw", { x: b.x, y: b.y });
    }

    // ── 압사 (§35-L) ──
    if (b.crushed && this.me.freezeLeftMs <= 0) this.die();

    // ── 사운드: 자기 이벤트 플래그 (avatar.ts a.fx) ──
    if (this.me.fx.has("wallJump")) feedback.wallKick(this, b.x, b.y);

    // ── 상태 송신 (relay) ──
    this.sendAcc += FIXED_MS;
    if (this.sendAcc >= 1000 / TUNING.net.sendRateHz) {
      this.sendAcc = 0;
      sendAvatarState(this.room, this.me, this.tick, this.dead);
    }
    this.me.fx.clear();
  }

  takeHit(): void {
    if (this.me.invincibleLeftMs > 0 || this.me.freezeLeftMs > 0) return;
    this.me.hp -= 1;
    this.me.invincibleLeftMs = 1500; // 피격 무적 (마리오식)
    if (this.me.hp <= 0) this.die();
    else feedback.hurt(this, this.me.body.x, this.me.body.y);
  }

  die(): void {
    this.dead = true;
    this.deadUntil = this.time.now + 1200;
    clearItemEffects(this.me);       // (라인 이탈과 동일하게 정리 — 단일 라인 테스트맵)
    this.myRect.setVisible(false);
    feedback.die(this, this.me.body.x, this.me.body.y);
    // dead 중엔 fixedTick의 주기 relay가 통째로 스킵되므로(§261), 전이 즉시 1회 명시 전송
    sendAvatarState(this.room, this.me, this.tick, true);
  }

  respawn(): void {
    this.dead = false;
    this.me = createAvatar(this.world.spawn.x, this.world.spawn.y, TUNING.sizes.playerHeight);
    this.me.hp = 1;
    this.myRect.setVisible(true);
  }

  /** 웅크림/슬라이드 시 목표 세로 배율 (§B2) — standingH()와 동일 기준(크기 무관 0.95타일) */
  private crouchScaleTarget(crouch: boolean, slide: boolean, bodyH: number): number {
    return crouch || slide ? (TUNING.crouch.heightTiles * TUNING.world.tileSize) / bodyH : 1;
  }

  render(delta: number): void {
    if (!this.stateReady()) return;   // 첫 상태 도착 전 스킵 (§28)
    const b = this.me.body;
    const dtSec = delta / 1000;
    stepSquash(this.mySquash);
    stepSpring(this.crouchSpring, this.crouchScaleTarget(this.me.crouch, this.me.slide, b.h), dtSec);
    // §sprites: 시트 준비됐으면 이미지로, 아니면 사각형 폴백(둘 다 항상 갱신해두고 visible만 토글
    // — 전환 시 위치가 안 어긋남).
    const spriteReady = stepSpriteView(
      this, this.mySpriteView, resolveAvatarAction(b),
      b.x + this.mySquash.offsetX, b.y + this.mySquash.offsetY, b.facing,
      b.w * this.mySquash.sx, b.h, this.mySquash.sy * this.crouchSpring.v,
    );
    this.myRect.setVisible(!spriteReady);
    this.myRect.setSize(b.w, b.h);
    this.myRect.setScale(this.mySquash.sx, this.mySquash.sy * this.crouchSpring.v);
    this.myRect.setPosition(b.x + this.mySquash.offsetX, b.y + this.mySquash.offsetY);
    // 무적=노랑 / 내려찍기·공중스핀=주황(애니메이션 없어 구별용) / 평상=파랑
    this.myRect.fillColor = this.me.invincibleLeftMs > 0 ? 0xffee55
      : this.me.pound !== 0 ? 0xffcc33 : 0x4488ff;
    // 무적(피격 직후·부활 직후 공용) 동안 점멸 — 부활 즉시 죽는 것 방지 유예를 시각으로도 표시
    const invAlpha = this.me.invincibleLeftMs > 0 ? flickerAlpha(this.time.now) : 1;
    this.myRect.setAlpha(invAlpha);
    this.mySpriteView.sprite.setAlpha(invAlpha);
    // 오디오 리스너 = 로컬 플레이어 위치 (거리감쇠·좌우팬 기준점)
    setListenerPosition(b.x, b.y);
    // 고스트 플레이어
    this.room.state.players.forEach((p: PlayerNet, id: string) => {
      if (id === this.room.sessionId) return;
      const v = this.players.get(id);
      if (!v) return;
      // 정지 감지 (B): tick이 staleMs 동안 안 오르면 = 탭 백그라운드 → 충돌 통과 대상
      const nowMs = this.time.now;
      if (p.tick !== v.lastTick) {
        v.lastTick = p.tick; v.lastTickAt = nowMs; v.stale = false;
        ghostSnapshot(v.ghost, nowMs, p.x, p.y, p.vx, p.vy);   // 새 패치 = 스냅샷 push
      } else if (nowMs - v.lastTickAt > TUNING.net.staleMs) v.stale = true;
      ghostRenderAt(v.ghost, nowMs - TUNING.net.interpDelayMs);   // 지연 시점 보간(예측 X)
      stepSquash(v.squash);
      stepSpring(v.crouchSpring, this.crouchScaleTarget(p.crouch, p.slide, p.h), dtSec);
      v.w = p.w; v.h = p.h; v.pound = p.pound;
      // §sprites: 원격 플레이어도 같은 아바타 시트 — 준비 전엔 rect 폴백
      const pReady = stepSpriteView(
        this, v.spriteView, resolveAvatarAction({ grounded: p.grounded, vx: p.vx }),
        v.ghost.x + v.squash.offsetX, v.ghost.y + v.squash.offsetY, (p.facing as 1 | -1) || 1,
        p.w * v.squash.sx, p.h, v.squash.sy * v.crouchSpring.v,
      );
      v.rect.setVisible(!pReady);
      v.rect.setSize(p.w, p.h);
      v.rect.setScale(v.squash.sx, v.squash.sy * v.crouchSpring.v);
      v.rect.setPosition(v.ghost.x + v.squash.offsetX, v.ghost.y + v.squash.offsetY);   // 찌부/shift 앵커 적용(내 몸과 동일)
      // 정지 = 반투명(통과 중), 무적(피격/부활 유예)이면 점멸 — 둘 다 아니면 불투명
      const pAlpha = v.stale ? 0.35 : p.invincible ? flickerAlpha(nowMs) : 1;
      v.rect.setAlpha(pAlpha);
      v.spriteView.sprite.setAlpha(pAlpha);
      v.label.setPosition(v.ghost.x, v.ghost.y - p.h - 4);
      // ── 사운드: 다른 플레이어 전이 감지 (PlayerState 필드만으로 재현 — listener.ts가 거리감쇠 적용) ──
      if (v.stale) return; // 백그라운드 정지 중엔 소리도 쉼(B)
      const clinging = !p.grounded && p.touchingWall !== 0;
      const pfx = this.playerFx.get(id);
      if (!pfx) {
        this.playerFx.set(id, {
          grounded: p.grounded, slide: p.slide, pound: p.pound,
          clinging, dead: p.dead, invincible: p.invincible, wallJumpSeq: p.wallJumpSeq,
        });
      } else {
        if (p.dead && !pfx.dead) {
          feedback.die(this, v.ghost.x, v.ghost.y);
        } else {
          // 사망 프레임엔 착지/점프 등 다른 전이와 안 겹치게 else로 분리
          if (p.grounded && !pfx.grounded) {
            if (pfx.pound === 2 && p.pound === 0) feedback.poundLandOther(this, v.ghost.x, v.ghost.y);
            else feedback.land(this, v.ghost.x, v.ghost.y);
          } else if (!p.grounded && pfx.grounded && p.vy < 0) {
            feedback.jump(this, v.ghost.x, v.ghost.y);
          }
          if (p.slide && !pfx.slide) feedback.slideStart(this, v.ghost.x, v.ghost.y);
          if (!pfx.pound && p.pound === 1) playSound("slam_start", { x: v.ghost.x, y: v.ghost.y });
          if (clinging && !pfx.clinging) feedback.wallGrab(this, v.ghost.x, v.ghost.y);
          if (p.wallJumpSeq !== pfx.wallJumpSeq) feedback.wallKick(this, v.ghost.x, v.ghost.y);
          // invincible 전이 = 피격 순간(사망과 동시 발생 시 위 dead 분기가 우선 처리되어 안 겹침)
          if (p.invincible && !pfx.invincible) feedback.hurt(this, v.ghost.x, v.ghost.y);
        }
        pfx.grounded = p.grounded; pfx.slide = p.slide; pfx.pound = p.pound;
        pfx.clinging = clinging; pfx.dead = p.dead; pfx.invincible = p.invincible; pfx.wallJumpSeq = p.wallJumpSeq;
      }
    });
    // 몬스터 (dead reckoning)
    this.room.state.monsters.forEach((m: MonsterNet, id: string) => {
      const v = this.monsters.get(id);
      if (!v) return;
      if (m.x !== v.ghost.srvX || m.y !== v.ghost.srvY) ghostSnapshot(v.ghost, this.time.now, m.x, m.y, m.vx, m.vy); // 새 패치 = 스냅샷
      ghostRenderAt(v.ghost, this.time.now - TUNING.net.interpDelayMs);   // 지연 시점 보간(예측 X)
      stepSquash(v.squash);
      const visible = m.alive && !m.hidden && this.monEffHits(id, m.hitCount) < m.hp;   // 로컬 확정 사망 즉시 숨김
      // §sprites: 시트 준비됐으면 이미지, 아니면 rect 폴백. 숨김 상태면 둘 다 끔.
      const mReady = visible && stepSpriteView(
        this, v.spriteView, resolveMonsterAction(m.currentAction),
        v.ghost.x + v.squash.offsetX, v.ghost.y + v.squash.offsetY, (m.facing as 1 | -1) || 1,
        m.w * v.squash.sx, m.h, v.squash.sy,
      );
      if (!visible) v.spriteView.sprite.setVisible(false);
      v.rect.setVisible(visible && !mReady); v.label.setVisible(visible);
      v.rect.setPosition(v.ghost.x + v.squash.offsetX, v.ghost.y + v.squash.offsetY);
      v.rect.setScale(v.squash.sx, v.squash.sy);
      v.rect.fillColor = m.stunned ? 0x999999 : m.windupAnim ? 0xff8888 : 0xcc66ff;
      // 재생성 유예(무적) 동안 점멸 — 상호작용 없음을 시각으로 알림. 스턴/윈드업은 스프라이트엔 틴트로.
      const mAlpha = this.room.state.serverTime < m.graceEndsAt ? flickerAlpha(this.time.now) : 1;
      v.rect.setAlpha(mAlpha);
      v.spriteView.sprite.setAlpha(mAlpha);
      if (m.stunned) v.spriteView.sprite.setTint(0x999999);
      else if (m.windupAnim) v.spriteView.sprite.setTint(0xff8888);
      else v.spriteView.sprite.clearTint();
      v.label.setPosition(v.ghost.x, v.ghost.y - m.h - 4);
      // ── 사운드/이펙트: MonsterState 전이 감지 (서버 emit이 클라로 직접 안 와서 상태값으로 엣지 검출) ──
      const prevFx = this.monsterFx.get(id);
      if (!prevFx) {
        this.monsterFx.set(id, { alive: m.alive, stunned: m.stunned, hidden: m.hidden, action: m.currentAction });
      } else {
        if (prevFx.alive && !m.alive) feedback.monsterDie(this, v.ghost.x, v.ghost.y);
        else if (!prevFx.alive && m.alive) feedback.monsterRespawn(this, v.ghost.x, v.ghost.y);
        if (!prevFx.stunned && m.stunned) feedback.monsterStunned(this, v.ghost.x, v.ghost.y);
        if (prevFx.hidden && !m.hidden) feedback.monsterEmerge(this, v.ghost.x, v.ghost.y);
        if (prevFx.action !== m.currentAction) monsterPatternChanged(this, m.currentAction, v.ghost.x, v.ghost.y);
        prevFx.alive = m.alive; prevFx.stunned = m.stunned; prevFx.hidden = m.hidden; prevFx.action = m.currentAction;
      }
    });
    // 발사체·아이템·블록 (발사체는 dead reckoning, 피격 판정은 서버 좌표 유지)
    this.room.state.projectiles.forEach((pr: ProjNet, id: string) => {
      const rr = this.projectiles.get(id);
      if (!rr) return;
      let g = this.projGhosts.get(id);
      if (!g) { g = createGhostView(pr.x, pr.y); this.projGhosts.set(id, g); }
      if (pr.x !== g.srvX || pr.y !== g.srvY) ghostServerUpdate(g, pr.x, pr.y, pr.vx, pr.vy);
      ghostStep(g, delta);
      rr.setPosition(g.x, g.y);
    });
    this.room.state.items.forEach((it: ItemNet, id: string) => {
      const r = this.itemRects.get(id);
      if (r) {
        // §sprites: 아이템도 시트 우선, 준비 전엔 rect. 펄스 배율은 둘 다 공통 적용.
        const pulse = itemPulseScale(this.time.now, TUNING.visual.itemPulseMs, TUNING.visual.itemPulseAmt);
        const sv = this.itemSprites.get(id);
        const size = TUNING.sizes.item * pulse;
        const itReady = !!sv && it.available && stepSpriteView(this, sv, "idle", it.x, it.y, 1, size, size);
        if (sv && !it.available) sv.sprite.setVisible(false);
        r.setVisible(it.available && !itReady);
        r.setPosition(it.x, it.y);
        // 아이템 = 노란 발광 테두리 + 스프링 확대·축소 펄스(§1.2, 항상 표시)
        r.setScale(pulse);
        if (this.grabHighlightUntil > this.time.now) r.setStrokeStyle(3, 0xffff00);
        else r.setStrokeStyle(2, 0xffee55, 0.85);
      }
    });
    // 잡기 파츠 렌더 (내가 든 것은 로컬 핀 §30-2, 남이 든 것은 서버 추종)
    this.room.state.carryables.forEach((c: CarryNet, id: string) => {
      const r = this.carryRects.get(id);
      if (!r) return;
      if (!r.visible && c.alive) feedback.objectRespawn(this, c.x, c.y);   // 재생성 전이 감지(§45)
      r.setVisible(c.alive);
      if (!c.alive) { this.carryGhosts.delete(id); return; }   // 재생성 시 순간이동 방지(다시 생성)
      if (this.carry.heldId === id) {
        // 웅크리면 손도 같이 낮아지도록 crouchSpring 반영(§B2 — 안 그러면 손이 줄어든 몸통 위로 붕 뜸)
        r.setPosition(b.x + b.facing * (b.w / 2 + TUNING.sizes.handOffset), b.y - b.h * 0.3 * this.crouchSpring.v);
      } else {
        let g = this.carryGhosts.get(id);
        if (!g) { g = createGhostView(c.x, c.y); this.carryGhosts.set(id, g); }
        ghostServerUpdate(g, c.x, c.y, 0, 0);   // 속도 없음 → 순수 lerp 수렴
        ghostStep(g, delta);
        r.setPosition(g.x, g.y);
      }
      if (this.grabHighlightUntil > this.time.now && !c.heldBy) r.setStrokeStyle(3, 0xffff00);
      else r.setStrokeStyle();
    });
    // 손 연출 (§30-3): 기본 손 + 캐릭터색 틴트 + 스프링(늦게 따라옴)
    if (this.carry.heldId) {
      const hx = b.x + b.facing * (b.w / 2 + TUNING.sizes.handOffset);
      const hy = b.y - b.h * 0.3 * this.crouchSpring.v;
      this.handRect.setVisible(true);
      this.handRect.x += (hx - this.handRect.x) * TUNING.carry.handLerp;
      this.handRect.y += (hy - this.handRect.y) * TUNING.carry.handLerp;
      this.handRect.fillColor = 0xcfe0ff;   // 캐릭터(파랑) 기반 밝은 틴트
    } else {
      this.handRect.setVisible(false);
    }
    this.room.state.blocks.forEach((bs: BlockNet, id: string) => {
      const r = this.blockRects.get(id);
      if (!r) return;
      const spec = this.blockSpecById.get(id);
      // reappearing 동안은 비충돌이지만(§상호작용은 active 게이트로 이미 배제) 화면엔 점멸로 보여준다.
      const bVisible = (bs.active && bs.visibleNow) || bs.reappearing;
      const bAlpha = bs.reappearing ? flickerAlpha(this.time.now) : 1;
      const g = this.blockGhosts.get(id);   // 충돌과 동일한 보간 위치
      const bumpFx = this.blockBumpFx.get(id);
      if (bumpFx) {
        if (this.time.now > bumpFx.untilMs) setSquash(bumpFx.squash, "none");
        stepSquash(bumpFx.squash, 0.35);
      }
      const bx = (g ? g.x : bs.x) + (bumpFx?.squash.offsetX ?? 0);
      const by = (g ? g.y : bs.y) + (bumpFx?.squash.offsetY ?? 0);
      // §sprites: 블록도 시트 우선(좌상단 앵커 → 바닥-중앙으로 변환해 전달), 준비 전엔 rect 폴백
      const sv = this.blockSprites.get(id);
      const bReady = !!sv && !!spec && bVisible
        && stepSpriteView(this, sv, "idle", bx + spec.w / 2, by + spec.h, 1, spec.w, spec.h);
      if (sv && (!bVisible || !bReady)) sv.sprite.setVisible(false);
      if (sv) {
        sv.sprite.setAlpha(bAlpha);
        if (bs.emptied) sv.sprite.setTint(0x555555); else sv.sprite.clearTint();
      }
      r.setVisible(bVisible && !bReady);
      r.setAlpha(bAlpha);
      r.setPosition(bx, by);
      r.fillColor = bs.emptied ? 0x555555 : 0x888888;
      // 접촉반응(낙하/파괴) 텔레그래프 — 시작 전이 감지(사운드 1회) + 시작시각 기록(진행도 연출용, §2026-07-16)
      const cfx = this.blockCrumbleFx.get(id);
      if (bs.crumbling && !cfx?.crumbling) {
        playSound("crumble", { x: bs.x, y: bs.y });
        this.blockCrumbleFx.set(id, { crumbling: true, startAt: this.time.now });
      } else {
        this.blockCrumbleFx.set(id, { crumbling: bs.crumbling, startAt: cfx?.startAt ?? this.time.now });
      }
    });
    this.drawVisualLanguage();
    this.renderServerview();
    this.renderRaceFx();
  }

  /**
   * 레이스 전용 연출(RaceState 있을 때만 동작 — testline/콘솔 경로는 필드가 없어 전부 스킵).
   * ① 라인 파괴 스윕: sweepIndex 증가 감지 → 전원 화면 흔들림 + 폭발음 + 파괴 라인의 모든 에셋 자리 폭발.
   * ② 라스트댄스: 1/2/3위(현재 bestX 순) 아바타 머리 위로 금/은/동 세로 직선(월드 오브젝트, 화려하지 않게).
   */
  private renderRaceFx(): void {
    const st = this.room.state as {
      phase?: string; sweepIndex?: number;
      members?: { forEach: (fn: (m: { bestX: number; rank: number }, id: string) => void) => void };
    };

    // ── ① 스윕 연출 ──
    const sweep = st.sweepIndex ?? 0;
    if (sweep > this.prevSweepIndex && this.world.lineRanges) {
      const t = TUNING.world.tileSize;
      for (let li = this.prevSweepIndex; li < sweep; li++) {
        const range = this.world.lineRanges[li];
        if (!range) continue;
        const x0 = range.startX * t, x1 = range.endX * t;
        const points: { x: number; y: number }[] = [];
        for (const bl of this.world.blocks) if (bl.x >= x0 && bl.x < x1) points.push({ x: bl.x + bl.w / 2, y: bl.y + bl.h / 2 });
        for (const mo of this.world.monsters) if (mo.x >= x0 && mo.x < x1) points.push({ x: mo.x, y: mo.y - mo.h / 2 });
        this.explodeAt(points);
      }
      screenShake(this, 450, 0.012);           // 전원 화면 흔들림(각자 클라에서 재생 = 전원)
      playSound("sweepHit", { x: this.me.body.x, y: this.me.body.y });   // 리스너 위치 = 풀 볼륨
    }
    this.prevSweepIndex = sweep;

    // ── ② 라스트댄스 금/은/동 세로선 ──
    if (this.entityVisualGfx && st.phase === "lastdance" && st.members) {
      const standings: { id: string; bestX: number }[] = [];
      st.members.forEach((m, id) => standings.push({ id, bestX: m.bestX }));
      standings.sort((a, b) => b.bestX - a.bestX);
      const MEDAL = [0xffd700, 0xc0c0c0, 0xcd7f32];   // 금/은/동
      const topY = this.world.top ?? 0;
      standings.slice(0, 3).forEach((s, i) => {
        let x: number | null = null, headY: number | null = null;
        if (s.id === this.room.sessionId) {
          x = this.me.body.x; headY = this.me.body.y - this.me.body.h;
        } else {
          const v = this.players.get(s.id);
          if (v) { x = v.ghost.x; headY = v.ghost.y - v.h; }
        }
        if (x === null || headY === null) return;
        this.entityVisualGfx.lineStyle(4, MEDAL[i], 0.9);
        this.entityVisualGfx.lineBetween(x, headY - 6, x, topY);
      });
    }
  }

  /** 파괴 이펙트 — 각 지점에 확장·페이드 원(가벼운 폭발 표현, 파티클 시스템 없이) */
  private explodeAt(points: { x: number; y: number }[]): void {
    for (const p of points) {
      const c = this.add.circle(p.x, p.y, 6, 0xff8833, 0.9).setDepth(15);
      this.tweens.add({
        targets: c, radius: 34, alpha: 0, duration: 420, ease: "Cubic.easeOut",
        onComplete: () => c.destroy(),
      });
    }
  }

  /** 프리셋 이름 → 감지 반경(px), 텔레그래프용 */
  private static readonly DETECT_PX: Record<string, number> = { near: TUNING.detect.nearPx, normal: TUNING.detect.normalPx, far: TUNING.detect.farPx };

  /**
   * 시각 언어 오버레이 — §1(항상 표시) 전부 + §2(근접/hover 맥락 표시) 전부(2026-07-15 전체 구현).
   * 스펙은 TESTMAP에서 id로 조회(런타임 스폰 몬스터 등 TESTMAP 밖 엔티티는 스펙이 없어 테두리 생략).
   */
  private drawVisualLanguage(): void {
    const ground = this.visualGfx;
    const entities = this.entityVisualGfx;
    ground.clear();
    entities.clear();
    const iAmInvincible = this.me.invincibleLeftMs > 0;
    const nowMs = this.time.now;
    const px = this.me.body.x, py = this.me.body.y;
    const pointer = this.input.activePointer;
    const nearPx = TUNING.visual.revealNearPx, farPx = TUNING.visual.revealFarPx;
    /** 대상 중심좌표 기준 노출도(근접 페이드 or 마우스 hover 중 더 큰 쪽). w/h는 대상 전체 폭·높이. */
    const revealAt = (cx: number, cy: number, w: number, h: number): number => {
      const dist = Math.hypot(cx - px, cy - py);
      const hovering = Math.abs(pointer.worldX - cx) < w / 2 && Math.abs(pointer.worldY - cy) < h / 2;
      return revealAlpha(dist, nearPx, farPx, hovering);
    };

    // ── 지형 레이어(ground, 엔티티보다 아래) ──────────────────────────────
    // 정적 지형 + 살아있는 직사각형 블록을 한 목록으로 모아 이음선 병합(1×1 타일 이어붙임 대응).
    const seamRects: SeamRect[] = [];
    for (const r of this.world.terrain.solids) {
      const f = facesOf(r);
      seamRects.push({
        left: r.x, top: r.y, w: r.w, h: r.h,
        faces: {
          top: f.top ? "solidWhite" : "dashed", bottom: f.bottom ? "solidWhite" : "dashed",
          left: f.left ? "solidWhite" : "dashed", right: f.right ? "solidWhite" : "dashed",
        },
      });
    }
    // 항상 표시(§1) 오버레이(스위치·물음표 발광)와 맥락 표시(§2)는 병합 테두리 위에 나중에 그려야 하므로 지연 수집.
    const laterDraws: Array<() => void> = [];
    this.room.state.blocks.forEach((bs: BlockNet, id: string) => {
      const spec = this.blockSpecById.get(id);
      if (!spec) return;
      const g = this.blockGhosts.get(id);
      const bumpFx = this.blockBumpFx.get(id);   // §B4: 띠용 오프셋 — 블록 사각형과 동일하게 테두리도 반영
      const left = (g ? g.x : bs.x) + (bumpFx?.squash.offsetX ?? 0), top = (g ? g.y : bs.y) + (bumpFx?.squash.offsetY ?? 0);
      const cx = left + spec.w / 2, cy = top + spec.h / 2;
      const reveal = revealAt(cx, cy, spec.w, spec.h);

      // 낙하/파괴 반응 텔레그래프 — 안전 정보라 active 여부와 무관하게 항상, reveal 게이팅 없음
      if (bs.crumbling) {
        const startAt = this.blockCrumbleFx.get(id)?.startAt ?? nowMs;
        const progress = Math.min(1, (nowMs - startAt) / TUNING.rules.crumbleWarnMs);
        laterDraws.push(() => drawCrumbleWarning(ground, left, top, spec.w, spec.h, nowMs, progress));
      }

      if (!bs.active || !bs.visibleNow) {
        // 스위치 OFF로 비실체화된 블록 — 유령 표시(§1.2). 실체 쪽과 통일: 항상 점선+움직임(2026-07-16 피드백:
        // "숨겨졌다 나타났을 때 실선으로 바뀌는 게 이상하다, 그냥 점선으로") — materialized=false만 다름.
        if (spec.switchReact && bs.active) {
          const whenOn = spec.switchReact.whenOn;
          laterDraws.push(() => drawSwitchAffectedBorder(ground, left, top, spec.w, spec.h, whenOn, this.room.state.switchOn, false, nowMs));
        }
        return;
      }

      const tags = blockVisualTagsFromSpec(spec);
      // switchToggler·switchAffected는 자체 테두리(회전 줄무늬/점선)가 전부라 일반 흰 실선 면 테두리를
      // 따로 또 그리면 뒤에 흰 테두리가 겹쳐 보임(2026-07-16 피드백: "흰 테두리 뭔가가 있는데"). 스킵.
      const hasOwnBorder = tags.auras.includes("switchToggler") || tags.auras.includes("switchAffected");
      if (tags.faces && !hasOwnBorder && (!spec.shape || spec.shape === "rect")) {
        // §sprites: 시트가 뜬 블록은 이음선 병합 대신 그림 윤곽에 면별 색을 직접 입힘
        const sv = this.blockSprites.get(id);
        const bPoly = sv ? getSpriteOutlineWorld(this, sv, left + spec.w / 2, top + spec.h, 1, spec.w, spec.h) : null;
        if (bPoly) {
          const faces = tags.faces;
          laterDraws.push(() => drawPolyFaceBorders(ground, bPoly, faces, iAmInvincible));
        } else {
          seamRects.push({ left, top, w: spec.w, h: spec.h, faces: tags.faces });
        }
      }
      if (tags.auras.includes("switchToggler")) {
        laterDraws.push(() => drawSwitchTogglerBorder(ground, left, top, spec.w, spec.h, this.room.state.switchOn, nowMs));
      } else if (tags.auras.includes("switchAffected") && spec.switchReact) {
        const whenOn = spec.switchReact.whenOn;
        laterDraws.push(() => drawSwitchAffectedBorder(ground, left, top, spec.w, spec.h, whenOn, this.room.state.switchOn, true, nowMs));
      }
      if (tags.auras.includes("itemGiver")) laterDraws.push(() => drawItemGiverGlow(ground, left, top, spec.w, spec.h, nowMs));

      // ── §2 맥락 표시 (근접/hover) ──
      if (reveal > 0) {
        if (tags.overlays.includes("ice")) laterDraws.push(() => drawIceGlint(ground, left, top, spec.w, nowMs, reveal));
        if (tags.overlays.includes("conveyor")) {
          const dir = (spec.properties?.find((p) => p.type === "conveyor")?.dir as "left" | "right") ?? "right";
          laterDraws.push(() => drawConveyorArrows(ground, left, top, spec.w, dir, nowMs, reveal));
        }
        if (tags.overlays.includes("dash")) laterDraws.push(() => drawDashLines(ground, left, top, spec.w, spec.h, reveal));
        if (tags.overlays.includes("bouncy")) laterDraws.push(() => drawBounceArrow(ground, cx, top, reveal));
        if (tags.overlays.includes("moving")) laterDraws.push(() => drawDirectionArrow(ground, cx, cy, bs.vx, bs.vy, reveal));
        if (tags.overlays.includes("rideStart")) laterDraws.push(() => drawRideHint(ground, cx, top, reveal));
        if (tags.overlays.includes("proximity") && tags.detectRange) {
          const r = BaseworldScene.DETECT_PX[tags.detectRange];
          const inside = Math.hypot(cx - px, cy - py) < r;
          laterDraws.push(() => drawDetectRing(ground, cx, cy, r, inside, reveal));
        }
        if (spec.visibility === "blink" && spec.blinkMs) {
          const msLeft = spec.blinkMs - (nowMs % spec.blinkMs);
          laterDraws.push(() => drawPeriodicWarning(ground, left, top, spec.w, spec.h, msLeft, nowMs));
        }
      }
    });
    drawSeamMergedBorders(ground, seamRects);
    for (const s of this.world.terrain.slopes) drawSlopeBorder(ground, s);
    for (const draw of laterDraws) draw();

    // ── 엔티티 레이어(entities, 자기 몸 위 — 병합 없이 항상 통짜로) ──────────
    // squash(벽 찌부·밀림 등 연출) 반영 — 시각 사각형이 움직이면 테두리도 같이 움직여야 함(피드백 2026-07-15).
    // 웅크림 스프링(§B2)도 반영 — 안 그러면 스프라이트는 줄어드는데 테두리는 원래 크기 그대로 남음(2026-07-16 피드백)
    // §sprites: 스프라이트가 준비됐으면 그림 윤곽에 면별 시각 언어를 입혀 테두리로(사각형 아님),
    // 아니면 사각 테두리 폴백. 플레이어 소속색(내=흰/남=회)은 4면 동일 스타일로 전달.
    const myScaleY = this.mySquash.sy * this.crouchSpring.v;
    const myPoly = getSpriteOutlineWorld(
      this, this.mySpriteView,
      this.me.body.x + this.mySquash.offsetX, this.me.body.y + this.mySquash.offsetY,
      this.me.body.facing, this.me.body.w * this.mySquash.sx, this.me.body.h, myScaleY,
    );
    if (myPoly) {
      drawPolyFaceBorders(entities, myPoly, { top: "solidWhite", bottom: "solidWhite", left: "solidWhite", right: "solidWhite" }, false);
    } else {
      drawPlayerBorder(entities, squashedBox(this.me.body.x, this.me.body.y, this.me.body.w, this.me.body.h,
        { ...this.mySquash, sy: myScaleY }), true);
    }
    this.room.state.players.forEach((p: PlayerNet, id: string) => {
      if (id === this.room.sessionId || p.dead) return;
      const v = this.players.get(id);
      if (!v || v.stale) return;
      const pPoly = getSpriteOutlineWorld(
        this, v.spriteView, v.ghost.x + v.squash.offsetX, v.ghost.y + v.squash.offsetY,
        (p.facing as 1 | -1) || 1, p.w * v.squash.sx, p.h, v.squash.sy * v.crouchSpring.v,
      );
      if (pPoly) {
        // 다른 플레이어 = 회색 — 시각 언어 색표에 회색이 없어 별도 단색 스트로크로 처리
        entities.lineStyle(BORDER_WIDTH - 1, 0x9a9a9a, 0.9);
        entities.beginPath();
        pPoly.forEach((pt, i) => { if (i === 0) entities.moveTo(pt.x, pt.y); else entities.lineTo(pt.x, pt.y); });
        entities.closePath();
        entities.strokePath();
      } else {
        drawPlayerBorder(entities, squashedBox(v.ghost.x, v.ghost.y, p.w, p.h,
          { ...v.squash, sy: v.squash.sy * v.crouchSpring.v }), false);
      }
    });
    this.room.state.monsters.forEach((m: MonsterNet, id: string) => {
      const visible = m.alive && !m.hidden && this.monEffHits(id, m.hitCount) < m.hp;
      if (!visible || this.room.state.serverTime < m.graceEndsAt) return;   // 재생성 유예 중엔 위험 표시 생략(점멸이 대신 알림)
      const spec = this.monsterSpecById.get(id);
      if (!spec) return;   // 콘솔 spawnmonster 등 맵 밖 엔티티는 스펙이 없어 테두리 생략
      const v = this.monsters.get(id);
      const mx = v ? v.ghost.x : m.x, my = v ? v.ghost.y : m.y;
      const box = squashedBox(mx, my, m.w, m.h, v ? v.squash : { sx: 1, sy: 1, offsetX: 0, offsetY: 0 });
      const cx = box.left + box.w / 2, topY = box.top;
      const tags = monsterVisualTagsFromSpec(spec);
      // §sprites: 윤곽 폴리곤에 면별 색(윗면 흰=밟기 가능, 옆·아래 빨강=위험 등) 그대로 적용
      const mPoly = v ? getSpriteOutlineWorld(
        this, v.spriteView, mx + v.squash.offsetX, my + v.squash.offsetY,
        (m.facing as 1 | -1) || 1, m.w * v.squash.sx, m.h, v.squash.sy,
      ) : null;
      if (tags.faces && mPoly) drawPolyFaceBorders(entities, mPoly, tags.faces, iAmInvincible);
      else if (tags.faces) drawFaceBorders(entities, box.left, box.top, box.w, box.h, tags.faces, iAmInvincible);

      const reveal = revealAt(mx, my - m.h / 2, m.w, m.h);
      if (tags.overlays.includes("hpPips") && m.hp > 1) {
        drawHpPips(entities, cx, topY, m.hp, m.hp - this.monEffHits(id, m.hitCount), reveal);
      }
      // 체력 무한(처치 불가) — §1 항상 표시(생존 판단에 중요한 정보라 근접 게이팅 없음)
      if (tags.auras.includes("immortal")) drawImmortalMark(entities, cx, topY);
      if (reveal > 0) {
        if (tags.overlays.includes("enrage")) drawEnrageMark(entities, cx, topY, reveal);
        if (tags.overlays.includes("shooter")) drawShooterMark(entities, cx, my - m.h / 2, m.facing, reveal);
        if (tags.overlays.includes("split")) drawSplitMark(entities, cx, topY, reveal);
        if (tags.overlays.includes("moving")) drawDirectionArrow(entities, cx, my - m.h / 2, m.vx, m.vy, reveal);
        if (tags.overlays.includes("proximity") && tags.detectRange) {
          const r = BaseworldScene.DETECT_PX[tags.detectRange];
          const inside = Math.hypot(mx - px, my - py) < r;
          drawDetectRing(entities, mx, my - m.h / 2, r, inside, reveal);
        }
      }
    });
  }

  /** serverview (§19): 옵션1 스프라이트박스 / 2 히트박스 / 3 서버수신 상태 */
  renderServerview(): void {
    this.debugGfx.clear();
    if (this.svOpts.size === 0) return;
    const showPlayer = this.svSubject === "all" || this.svSubject === "player";
    const showTerrain = this.svSubject === "all" || this.svSubject === "terrain";
    const showMonster = this.svSubject === "all" || this.svSubject === "monster";
    if (this.svOpts.has(2)) {
      this.debugGfx.lineStyle(2, 0x4488ff, 1);
      if (showPlayer) {
        const b = this.me.body;
        this.debugGfx.strokeRect(b.x - b.w / 2, b.y - b.h, b.w, b.h);
      }
      if (showTerrain) {
        this.debugGfx.lineStyle(1, 0x33ff77, 0.7);
        for (const s of this.currentTerrain().solids) this.debugGfx.strokeRect(s.x, s.y, s.w, s.h);
      }
      if (showMonster) {
        this.debugGfx.lineStyle(2, 0xcc66ff, 1);
        this.room.state.monsters.forEach((m: MonsterNet) => {
          if (m.alive) this.debugGfx.strokeRect(m.x - m.w / 2, m.y - m.h, m.w, m.h);
        });
      }
    }
    if (this.svOpts.has(1) && showPlayer) {
      this.debugGfx.fillStyle(0xffffff, 0.12);
      const r = this.myRect;
      this.debugGfx.fillRect(r.x - (r.width * r.scaleX) / 2, r.y - r.height * r.scaleY, r.width * r.scaleX, r.height * r.scaleY);
    }
    if (this.svOpts.has(3)) {
      this.room.state.players.forEach((p: PlayerNet, id: string) => {
        const mine = id === this.room.sessionId;
        this.debugGfx.lineStyle(2, mine ? 0x00e5e5 : 0x7CFC00, 1);   // 청록=내것, 연두=남 (§19-2)
        this.debugGfx.strokeRect(p.x - p.w / 2, p.y - p.h, p.w, p.h);
      });
    }
  }
}

// ── 네트 상태 타입 (schema 미러 — any 회피용 최소 형태) ──
interface PlayerNet { x: number; y: number; vx: number; vy: number; w: number; h: number; facing: number; nickname: string; tick: number; pound: number; slide: boolean; crouch: boolean; grounded: boolean; touchingWall: number; dead: boolean; wallJumpSeq: number; invincible: boolean }
interface MonsterNet { asset: string; x: number; y: number; vx: number; vy: number; w: number; h: number; facing: number; alive: boolean; stunned: boolean; hidden: boolean; hitCount: number; hp: number; windupAnim: string; windupEndsAt: number; currentAction: string; graceEndsAt: number }
interface BlockNet { x: number; y: number; vx: number; vy: number; active: boolean; emptied: boolean; visibleNow: boolean; reappearing: boolean; crumbling: boolean }
interface ItemNet { kind: string; x: number; y: number; available: boolean }
interface CarryNet { x: number; y: number; alive: boolean; heldBy: string }
interface ProjNet { asset: string; x: number; y: number; vx: number; vy: number; effect: string; ownerId: string }
