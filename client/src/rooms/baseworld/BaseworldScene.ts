// baseworld 씬: 로컬 권위 아바타 + 고스트/몬스터 표현 + 자기화면 판정(§14) + serverview.
// Phaser는 렌더·입력만 (물리는 shared).
import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { getStateCallbacks } from "@colyseus/sdk";
import { TUNING, type Terrain } from "shared/physics";
import "shared/behavior";
import "shared/properties";
import {
  type Avatar, type AvatarInput, createAvatar, stepAvatar, applyItem, clearItemEffects,
  pushSelfOut, checkIStomped, checkStompedMe, headStand,
  createCarryState, stepCarry, type CarryState, type Carryable,
  blockRect, type ItemSpec,
} from "shared/parts";
import { getProperty } from "shared/properties";
import { TESTMAP } from "shared/maps";
import {
  createGhostView, ghostServerUpdate, ghostStep, type GhostView,
} from "../../netphysics/interpolate.js";
import { sendAvatarState } from "../../netphysics/reconcile.js";
import { createSquash, setSquash, stepSquash, type SquashState } from "../../netphysics/squash.js";

const FIXED_MS = 1000 / TUNING.world.tickRate;

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
}

export class BaseworldScene extends Phaser.Scene {
  room: Room;
  me: Avatar = createAvatar(TESTMAP.spawn.x, TESTMAP.spawn.y, 115);
  carry: CarryState = createCarryState();
  mySquash = createSquash();
  tick = 0;
  acc = 0;
  sendAcc = 0;
  keys!: Record<"left" | "right" | "jump" | "down" | "run" | "grab", Phaser.Input.Keyboard.Key[]>;
  players = new Map<string, View>();
  monsters = new Map<string, View>();
  projectiles = new Map<string, Phaser.GameObjects.Rectangle>();
  itemRects = new Map<string, Phaser.GameObjects.Rectangle>();
  carryRects = new Map<string, Phaser.GameObjects.Rectangle>();
  blockRects = new Map<string, Phaser.GameObjects.Rectangle>();
  myRect!: Phaser.GameObjects.Rectangle;
  handRect!: Phaser.GameObjects.Rectangle;
  debugGfx!: Phaser.GameObjects.Graphics;
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
  selfFx = { kind: "none" as "none" | "stomped" | "shift" | "squeeze" | "ceil", dir: 1, amt: 8, left: 0 };

  constructor(room: Room) {
    super("baseworld");
    this.room = room;
  }

  /** 지연 큰 환경: join 직후 첫 상태 도착 전엔 스키마 맵이 undefined (§28 가드) */
  stateReady(): boolean {
    const s = this.room.state;
    return !!(s && s.players && s.blocks && s.monsters && s.items && s.projectiles && s.carryables);
  }

  // ── 지형 (동적 블록 반영) ──
  currentTerrain(): Terrain {
    const solids = [...TESTMAP.terrain.solids];
    if (!this.room.state?.blocks) return { solids, slopes: TESTMAP.terrain.slopes };
    this.room.state.blocks.forEach((bs: { x: number; y: number; active: boolean; visibleNow: boolean }, id: string) => {
      if (!bs.active || !bs.visibleNow) return;
      const spec = TESTMAP.blocks.find((b) => b.id === id);
      if (spec) solids.push({ x: bs.x, y: bs.y, w: spec.w, h: spec.h, faces: spec.faces });
    });
    return { solids, slopes: TESTMAP.terrain.slopes };
  }

  create(): void {
    const t = TUNING.world.tileSize;
    // 격자 + 지형
    const grid = this.add.graphics().setDepth(-2);
    grid.lineStyle(1, 0xffffff, 0.06);
    for (let x = 0; x <= TESTMAP.width; x += t) grid.lineBetween(x, 0, x, TESTMAP.height);
    for (let y = 0; y <= TESTMAP.height; y += t) grid.lineBetween(0, y, TESTMAP.width, y);
    for (const s of TESTMAP.terrain.solids) {
      this.add.rectangle(s.x, s.y, s.w, s.h, 0x555566).setOrigin(0, 0).setDepth(-1);
    }
    const slopeG = this.add.graphics().setDepth(-1);
    slopeG.fillStyle(0x555566, 1);
    for (const s of TESTMAP.terrain.slopes) {
      if (s.dir === 1) slopeG.fillTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x + s.w, s.y);
      else slopeG.fillTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x, s.y);
    }
    // 깃발 (라인 경계 시각화)
    this.add.rectangle(TESTMAP.line.startX + 8, TESTMAP.spawn.y - 96, 8, 96, 0x44ff44).setOrigin(0, 0).setDepth(-1);
    this.add.rectangle(TESTMAP.line.endX - 16, TESTMAP.spawn.y - 96, 8, 96, 0xffd744).setOrigin(0, 0).setDepth(-1);

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

    // 내 아바타
    this.myRect = this.add.rectangle(0, 0, this.me.body.w, this.me.body.h, 0x4488ff).setOrigin(0.5, 1).setDepth(5);
    this.handRect = this.add.rectangle(0, 0, 14, 14, 0xffffff).setDepth(6).setVisible(false);
    this.debugGfx = this.add.graphics().setDepth(20);

    const $ = getStateCallbacks(this.room);
    // 고스트 플레이어
    $(this.room.state).players.onAdd((p: PlayerNet, id: string) => {
      if (id === this.room.sessionId) return;
      const v = this.makeView(p.x, p.y, p.w, p.h, 0xff5555, p.nickname || id.slice(0, 4));
      this.players.set(id, v);
    });
    $(this.room.state).players.onRemove((_p: PlayerNet, id: string) => this.dropView(this.players, id));
    // 몬스터
    $(this.room.state).monsters.onAdd((m: MonsterNet, id: string) => {
      const v = this.makeView(m.x, m.y, m.w, m.h, 0xcc66ff, m.asset);
      this.monsters.set(id, v);
    });
    $(this.room.state).monsters.onRemove((_m: MonsterNet, id: string) => this.dropView(this.monsters, id));
    // 발사체
    $(this.room.state).projectiles.onAdd((pr: ProjNet, id: string) => {
      this.projectiles.set(id, this.add.rectangle(pr.x, pr.y, 24, 24, 0xffaa33).setOrigin(0.5, 1).setDepth(4));
    });
    $(this.room.state).projectiles.onRemove((_pr: ProjNet, id: string) => {
      this.projectiles.get(id)?.destroy();
      this.projectiles.delete(id);
    });
    // 아이템
    $(this.room.state).items.onAdd((it: ItemNet, id: string) => {
      this.itemRects.set(id, this.add.rectangle(it.x, it.y, 28, 28, 0x66ffcc).setOrigin(0.5, 1).setDepth(3));
    });
    // 잡기 파츠 (돌)
    $(this.room.state).carryables.onAdd((c: CarryNet, id: string) => {
      this.carryRects.set(id, this.add.rectangle(c.x, c.y, 36, 36, 0xb08850).setOrigin(0.5, 1).setDepth(3));
    });
    // 잡기 거부 (서버 소유권 패배 §30-4) — 손에서 사라짐, 이전 행동 원복 없음
    this.room.onMessage("grabDenied", (m: { objId: string }) => {
      if (this.carry.heldId === m.objId) this.carry.heldId = null;
    });
    // 블록
    $(this.room.state).blocks.onAdd((bs: BlockNet, id: string) => {
      const spec = TESTMAP.blocks.find((b) => b.id === id);
      if (!spec) return;
      this.blockRects.set(id, this.add.rectangle(bs.x, bs.y, spec.w, spec.h, 0x8888aa).setOrigin(0, 0).setDepth(2));
    });
    // 아이템 획득 중재 결과 (§60)
    this.room.onMessage("itemClaim", (m: { itemId: string; winner: string | null }) => {
      if (m.winner === this.room.sessionId) {
        const spec = TESTMAP.items.find((i) => i.id === m.itemId)
          ?? ({ id: m.itemId, kind: this.room.state.items.get(m.itemId)?.kind ?? "speed", x: 0, y: 0 } as ItemSpec);
        applyItem(this.me, spec);
      }
    });
    this.room.onMessage("tp", (m: { sessionId: string; x: number; y: number }) => {
      if (m.sessionId === this.room.sessionId) { this.me.body.x = m.x; this.me.body.y = m.y; }
    });

    this.cameras.main.setBounds(0, 0, TESTMAP.width, TESTMAP.height);
    this.cameras.main.startFollow(this.myRect, true, 0.15, 0.15);
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
    };
  }
  dropView(map: Map<string, View>, id: string): void {
    const v = map.get(id);
    v?.rect.destroy(); v?.label.destroy();
    map.delete(id);
  }

  update(_time: number, delta: number): void {
    this.acc += delta;
    while (this.acc >= FIXED_MS) { this.acc -= FIXED_MS; this.fixedTick(); }
    this.render(delta);
  }

  held(k: keyof BaseworldScene["keys"]): boolean {
    return this.keys[k].some((key) => key.isDown);
  }

  fixedTick(): void {
    if (!this.stateReady()) return;   // 첫 상태 도착 전 스킵 (§28)
    this.tick++;
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
          this.me = createAvatar(this.macroStart.x, this.macroStart.y, 115);
        }
      }
      input = { ...this.macroBuf[this.macroIdx++], tick: this.tick };
    }
    const terrain = this.currentTerrain();
    const b = this.me.body;
    const prevVy = b.vy;
    const prevPound = this.me.pound;

    stepAvatar(this.me, input, FIXED_MS, terrain);

    // ── PvP: 자기 화면 판정 (§14) ──
    const GRACE = TUNING.push.visualGraceMs;
    // 정지(백그라운드) 고스트는 밀기·밟기·서기 판정에서 제외 = 충돌 통과 (B)
    const ghostViews = [...this.players.values()].filter((v) => !v.stale);
    const ghosts = ghostViews.map((v) => ({
      x: v.ghost.x, y: v.ghost.y, w: v.w, h: v.h, vy: v.ghost.lastVy,
    }));
    // 유예 감쇠: 접촉이 순간 끊겨도 GRACE 동안 연출 유지 (깜빡임 방지)
    for (const v of ghostViews) {
      v.fxLeftMs = Math.max(0, v.fxLeftMs - FIXED_MS);
      if (v.fxLeftMs <= 0) setSquash(v.squash, "none");
    }
    this.selfFx.left = Math.max(0, this.selfFx.left - FIXED_MS);
    pushSelfOut(b, ghosts);
    const poundReach = this.me.pound !== 0 ? TUNING.stomp.poundReachMult : 1;
    const stompedIdx = checkIStomped(this.me, ghosts, TUNING, poundReach);
    if (stompedIdx >= 0) {
      this.me.fx.add("stompedOther");
      setSquash(ghostViews[stompedIdx].squash, "stomped");   // 밟힌 상대 찌부 (내 화면)
      ghostViews[stompedIdx].fxLeftMs = GRACE;
    }
    const stompedMe = checkStompedMe(this.me, ghosts);
    headStand(b, ghosts);
    // 밀기 연출 역할 구분 (§26 정정):
    //  - 밀리는 쪽 = squeeze(찌부)
    //  - 미는 쪽 = 찌부 아님, 상대가 찌부된 만큼 미는 방향으로 스프라이트 shift
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      const contact = Math.abs(g.x - b.x) < (g.w + b.w) / 2 && g.y > b.y - b.h && g.y - g.h < b.y;
      if (!contact) continue;
      const dirToGhost = g.x >= b.x ? 1 : -1;
      const iPush = (input.right && dirToGhost === 1) || (input.left && dirToGhost === -1);
      // 상대가 나를 향해 이동 중이면 "상대가 미는 중" (임계값 튜닝)
      const RATIO = TUNING.push.squeezeRatio;   // 찌부 비율 = shift 비율 (폭 비례 → 크기단계 자동)
      const ghostPush = Math.abs(ghostViews[i].ghost.lastVx) > TUNING.push.velThreshold
        && Math.sign(ghostViews[i].ghost.lastVx) === -dirToGhost;
      if (iPush && ghostPush) {
        // 맞밀기: 둘 다 찌부
        setSquash(ghostViews[i].squash, "squeeze", dirToGhost, RATIO);
        ghostViews[i].fxLeftMs = GRACE;
        this.selfFx = { kind: "squeeze", dir: -dirToGhost, amt: RATIO, left: GRACE };
      } else if (iPush) {
        // 내가 밈: 상대=찌부(폭×RATIO), 나=같은 px만큼 파고드는 shift
        setSquash(ghostViews[i].squash, "squeeze", dirToGhost, RATIO);
        ghostViews[i].fxLeftMs = GRACE;
        this.selfFx = { kind: "shift", dir: dirToGhost, amt: g.w * RATIO, left: GRACE };
      } else if (ghostPush) {
        // 상대가 나를 밈: 나=찌부, 상대=내 찌부량(px)만큼 shift
        setSquash(ghostViews[i].squash, "shift", -dirToGhost, b.w * RATIO);
        ghostViews[i].fxLeftMs = GRACE;
        this.selfFx = { kind: "squeeze", dir: -dirToGhost, amt: RATIO, left: GRACE };
      }
    }
    // 자기 스프라이트 연출 (우선순위: 밟힘 > 천장 > shift 유예)
    if (stompedMe) { this.selfFx = { kind: "stomped", dir: 1, amt: 0, left: GRACE }; }
    else if (this.me.fx.has("ceilBonk")) { this.selfFx = { kind: "ceil", dir: 1, amt: 0, left: GRACE }; }
    if (this.selfFx.left > 0) {
      if (this.selfFx.kind === "shift") setSquash(this.mySquash, "shift", this.selfFx.dir, this.selfFx.amt);
      else if (this.selfFx.kind === "squeeze") setSquash(this.mySquash, "squeeze", this.selfFx.dir, this.selfFx.amt || TUNING.push.squeezeRatio);
      else setSquash(this.mySquash, this.selfFx.kind === "none" ? "none" : this.selfFx.kind);
    } else {
      setSquash(this.mySquash, "none");
    }

    // ── 몬스터: 자기 화면 판정 ──
    for (const v of this.monsters.values()) setSquash(v.squash, "none");
    this.room.state.monsters.forEach((m: MonsterNet, id: string) => {
      if (!m.alive || m.hidden) return;
      const v = this.monsters.get(id);
      const mx = v ? v.ghost.x : m.x, my = v ? v.ghost.y : m.y;
      // 내려찍기 시 판정 확대 (몬스터 한정 — 지형·블록은 그대로)
      const poundMult = prevPound === 2 ? TUNING.stomp.poundReachMult : 1;
      const halfW = (b.w * poundMult) / 2;
      const hOv = Math.min(b.x + halfW, mx + m.w / 2) - Math.max(b.x - halfW, mx - m.w / 2);
      const vOv = Math.min(b.y, my) - Math.max(b.y - b.h, my - m.h);
      if (hOv <= 0 || vOv <= 0) return;
      const falling = prevVy > TUNING.stomp.minFallSpeed || prevPound === 2;
      const onHead = b.y <= my - m.h + TUNING.stomp.headBandPx * poundMult;
      if (falling && onHead) {
        // 밟기 성공: 즉시 튕김(손맛) + 강화점프 창 + 서버 타격 등록 (§21-2)
        b.vy = TUNING.stomp.bounceVelocity;
        this.me.stompComboLeftMs = TUNING.stomp.jumpWindowMs;
        this.room.send("hitMonster", { monsterId: id, hitId: `h${this.monsterHitSeq++}` });
        if (v) setSquash(v.squash, "stomped");
      } else if (this.me.invincibleLeftMs > 0) {
        this.room.send("hitMonster", { monsterId: id, hitId: `h${this.monsterHitSeq++}` });
      } else {
        this.takeHit(); // 접촉 피해 = 자기 클라 확정
      }
    });

    // ── 발사체 피격 (자책 방지 §30-1) ──
    this.room.state.projectiles.forEach((pr: ProjNet, _id: string) => {
      if (pr.ownerId === this.room.sessionId && this.carry.selfIgnoreLeftMs > 0) return;
      const hOv = Math.abs(pr.x - b.x) < (24 + b.w) / 2;
      const vOv = pr.y > b.y - b.h && pr.y - 24 < b.y;
      if (hOv && vOv && this.me.invincibleLeftMs <= 0) {
        if (pr.effect === "knockback") { b.vx = Math.sign(b.x - pr.x) * TUNING.item.knockbackVx; b.vy = TUNING.item.knockbackVy; }
        else this.takeHit();
      }
    });

    // ── 블록 상호작용: 머리치기/내려찍기 파괴·물음표·물성 ──
    this.room.state.blocks.forEach((bs: BlockNet, id: string) => {
      const spec = TESTMAP.blocks.find((bl) => bl.id === id);
      if (!spec || !bs.active || !bs.visibleNow) return;
      const r = blockRect({ spec, x: bs.x, y: bs.y, state: "active", respawnLeftMs: 0, emptied: bs.emptied, mem: {} });
      const withinX = Math.abs(b.x - (r.x + r.w / 2)) < (b.w + r.w) / 2;
      const headAt = b.y - b.h;
      const bonkHead = withinX && prevVy < 0 && Math.abs(headAt - (r.y + r.h)) < 10;
      const poundOn = withinX && prevPound === 2 && Math.abs(b.y - r.y) < 12;
      if (bonkHead) {
        if (spec.emitsItem && !bs.emptied) this.room.send("hitQBlock", { blockId: id });
        else if (spec.breakBy?.headbutt) this.room.send("breakBlock", { blockId: id, by: "headbutt" });
      }
      if (poundOn && spec.breakBy?.pound) this.room.send("breakBlock", { blockId: id, by: "pound" });
      // 물성 (당하는 쪽 로컬 적용 §properties)
      if (spec.properties) {
        const touching = withinX && b.y >= r.y - 2 && b.y - b.h <= r.y + r.h + 2;
        const standing = withinX && Math.abs(b.y - r.y) < 4 && b.grounded;
        for (const propSpec of spec.properties) {
          const impl = getProperty(propSpec.type);
          if (!impl) continue;
          if (standing && impl.onStand) impl.onStand(b, TUNING, propSpec);
          if (touching && impl.onTouch) {
            const side = standing ? "top" : bonkHead ? "bottom" : b.x < r.x + r.w / 2 ? "right" : "left";
            impl.onTouch(b, r, side, TUNING, propSpec);
          }
        }
      }
    });
    // 물성 부수효과 플래그 소비
    const flags = b as unknown as { __takeDamage?: boolean; __die?: boolean; __toggleSwitch?: boolean };
    if (flags.__toggleSwitch) { this.room.send("toggleSwitch", {}); flags.__toggleSwitch = false; }
    if (flags.__die) { flags.__die = false; this.die(); }
    if (flags.__takeDamage) { flags.__takeDamage = false; this.takeHit(); }

    // ── 아이템 접촉 → 서버 경합 (§60) ──
    this.room.state.items.forEach((it: ItemNet, id: string) => {
      if (!it.available) return;
      if (Math.abs(it.x - b.x) < (28 + b.w) / 2 && Math.abs(it.y - b.y) < b.h) {
        this.room.send("claimItem", { itemId: id });
      }
    });

    // ── 잡기 (§30): 로컬 즉시 잡기 + 서버 소유권 통지 ──
    const carryables: Carryable[] = [];
    this.room.state.carryables.forEach((c: CarryNet, id: string) => {
      if (!c.alive) return;
      const cb = { x: c.x, y: c.y, vx: 0, vy: 0, w: 36, h: 36, grounded: true, facing: 1 as const, touchingWall: 0 as const, onSlopeDir: 0 as const, gravity: true, tags: [] };
      carryables.push({ id, body: cb, grabbable: true, heldBy: c.heldBy || null });
    });
    const ev = stepCarry(this.carry, this.me, input, carryables);
    if (ev.kind === "grabMiss") this.grabHighlightUntil = now + 800;
    else if (ev.kind === "grab" && ev.id) this.room.send("grabObj", { objId: ev.id });
    else if (ev.kind === "throw" && ev.id) {
      this.room.send("throwObj", {
        objId: ev.id,
        x: b.x + b.facing * (b.w / 2 + 20), y: b.y - b.h * 0.5,
        vx: ev.vx ?? 0, vy: ev.vy ?? 0,
      });
    }

    // ── 압사 (§35-L) ──
    if (b.crushed && this.me.freezeLeftMs <= 0) this.die();

    // ── 상태 송신 (relay) ──
    this.sendAcc += FIXED_MS;
    if (this.sendAcc >= 1000 / TUNING.net.sendRateHz) {
      this.sendAcc = 0;
      sendAvatarState(this.room, this.me, this.tick);
    }
    this.me.fx.clear();
  }

  takeHit(): void {
    if (this.me.invincibleLeftMs > 0 || this.me.freezeLeftMs > 0) return;
    this.me.hp -= 1;
    this.me.invincibleLeftMs = 1500; // 피격 무적 (마리오식)
    if (this.me.hp <= 0) this.die();
  }

  die(): void {
    this.dead = true;
    this.deadUntil = this.time.now + 1200;
    clearItemEffects(this.me);       // (라인 이탈과 동일하게 정리 — 단일 라인 테스트맵)
    this.myRect.setVisible(false);
  }

  respawn(): void {
    this.dead = false;
    this.me = createAvatar(TESTMAP.spawn.x, TESTMAP.spawn.y, 115);
    this.me.hp = 1;
    this.myRect.setVisible(true);
  }

  render(delta: number): void {
    if (!this.stateReady()) return;   // 첫 상태 도착 전 스킵 (§28)
    const b = this.me.body;
    stepSquash(this.mySquash);
    this.myRect.setSize(b.w, b.h);
    this.myRect.setScale(this.mySquash.sx, this.mySquash.sy);
    this.myRect.setPosition(b.x + this.mySquash.offsetX, b.y + this.mySquash.offsetY);
    this.myRect.fillColor = this.me.invincibleLeftMs > 0 ? 0xffee55 : this.me.pound !== 0 ? 0xffcc33 : 0x4488ff;
    // 고스트 플레이어
    this.room.state.players.forEach((p: PlayerNet, id: string) => {
      if (id === this.room.sessionId) return;
      const v = this.players.get(id);
      if (!v) return;
      // 정지 감지 (B): tick이 staleMs 동안 안 오르면 = 탭 백그라운드 → 충돌 통과 대상
      const nowMs = this.time.now;
      if (p.tick !== v.lastTick) { v.lastTick = p.tick; v.lastTickAt = nowMs; v.stale = false; }
      else if (nowMs - v.lastTickAt > TUNING.net.staleMs) v.stale = true;
      ghostServerUpdate(v.ghost, p.x, p.y, p.vx, p.vy);
      ghostStep(v.ghost, delta);
      stepSquash(v.squash);
      v.w = p.w; v.h = p.h;
      v.rect.setSize(p.w, p.h);
      v.rect.setScale(v.squash.sx, v.squash.sy);
      v.rect.setPosition(v.ghost.x, v.ghost.y);
      v.rect.setAlpha(v.stale ? 0.35 : 1);   // 정지 = 반투명 (통과 중임을 표시)
      v.label.setPosition(v.ghost.x, v.ghost.y - p.h - 4);
    });
    // 몬스터 (dead reckoning)
    this.room.state.monsters.forEach((m: MonsterNet, id: string) => {
      const v = this.monsters.get(id);
      if (!v) return;
      ghostServerUpdate(v.ghost, m.x, m.y, m.vx, m.vy);
      ghostStep(v.ghost, delta, TUNING.net.monsterLerp);
      stepSquash(v.squash);
      const visible = m.alive && !m.hidden;
      v.rect.setVisible(visible); v.label.setVisible(visible);
      v.rect.setPosition(v.ghost.x, v.ghost.y);
      v.rect.setScale(v.squash.sx, v.squash.sy);
      v.rect.fillColor = m.stunned ? 0x999999 : m.windupAnim ? 0xff8888 : 0xcc66ff;
      v.label.setPosition(v.ghost.x, v.ghost.y - m.h - 4);
    });
    // 발사체·아이템·블록
    this.room.state.projectiles.forEach((pr: ProjNet, id: string) => {
      this.projectiles.get(id)?.setPosition(pr.x, pr.y);
    });
    this.room.state.items.forEach((it: ItemNet, id: string) => {
      const r = this.itemRects.get(id);
      if (r) {
        r.setVisible(it.available);
        r.setPosition(it.x, it.y);
        if (this.grabHighlightUntil > this.time.now) r.setStrokeStyle(3, 0xffff00);
        else r.setStrokeStyle();
      }
    });
    // 잡기 파츠 렌더 (내가 든 것은 로컬 핀 §30-2, 남이 든 것은 서버 추종)
    this.room.state.carryables.forEach((c: CarryNet, id: string) => {
      const r = this.carryRects.get(id);
      if (!r) return;
      r.setVisible(c.alive);
      if (!c.alive) return;
      if (this.carry.heldId === id) {
        r.setPosition(b.x + b.facing * (b.w / 2 + 20), b.y - b.h * 0.3);
      } else {
        r.setPosition(c.x, c.y);
      }
      if (this.grabHighlightUntil > this.time.now && !c.heldBy) r.setStrokeStyle(3, 0xffff00);
      else r.setStrokeStyle();
    });
    // 손 연출 (§30-3): 기본 손 + 캐릭터색 틴트 + 스프링(늦게 따라옴)
    if (this.carry.heldId) {
      const hx = b.x + b.facing * (b.w / 2 + 20);
      const hy = b.y - b.h * 0.3;
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
      r.setVisible(bs.active && bs.visibleNow);
      r.setPosition(bs.x, bs.y);
      r.fillColor = bs.emptied ? 0x555555 : 0x8888aa;
    });
    this.renderServerview();
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
interface PlayerNet { x: number; y: number; vx: number; vy: number; w: number; h: number; facing: number; nickname: string }
interface MonsterNet { asset: string; x: number; y: number; vx: number; vy: number; w: number; h: number; alive: boolean; stunned: boolean; hidden: boolean; windupAnim: string; windupEndsAt: number }
interface BlockNet { x: number; y: number; active: boolean; emptied: boolean; visibleNow: boolean }
interface ItemNet { kind: string; x: number; y: number; available: boolean }
interface CarryNet { x: number; y: number; alive: boolean; heldBy: string }
interface ProjNet { asset: string; x: number; y: number; vx: number; vy: number; effect: string; ownerId: string }
