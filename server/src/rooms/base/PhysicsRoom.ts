// PhysicsRoom — relay 중계 + 서버 권위 시뮬 공통 뼈대 (§14·§21·§60).
// 플레이어: 검증 없이 상태 relay. 몬스터·이동블록·발사체·스위치·경합: 서버가 확정.
import { Room, Client } from "colyseus";
import {
  TUNING, applyTuning, moveAndCollide, type Terrain, type Body,
  createBody, clampSpeed,
} from "shared/physics";
import "shared/behavior";                       // 조건·행동 레지스트리 등록
import {
  type MonsterSpec, type MonsterInstance, createMonster, stepMonster,
  updateAggro, registerHit,
  type BlockSpec, type BlockInstance, createBlock, blockSolid, blockRect,
  tryBreak, stepBlockRespawn,
  type ItemSpec, type ItemInstance, createItem,
  type ProjectileSpec, type ProjectileInstance, spawnProjectile, stepProjectile,
  type LineBounds, checkLineExit,
} from "shared/parts";
import { compileRules, stepRules, type Ctx } from "shared/behavior";
import {
  GameState, PlayerState, MonsterState, BlockState, ItemState, ProjectileState,
  CarryableState,
} from "../schema/GameState.js";

const FIXED_MS = 1000 / TUNING.world.tickRate;

/** 경합 중재 (§60): 윈도우 동안 모아 도착 빠를수록 가중치 큰 랜덤 당첨 */
interface Claim { itemId: string; sessionId: string; at: number }

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

export abstract class PhysicsRoom extends Room {
  state = new GameState();
  protected terrainBase!: Terrain;
  protected line!: LineBounds;
  protected monstersRt = new Map<string, MonsterInstance>();
  protected blocksRt = new Map<string, BlockInstance>();
  protected itemsRt = new Map<string, ItemInstance>();
  protected projectilesRt = new Map<string, ProjectileInstance>();
  protected claims: Claim[] = [];
  protected carryDefs = new Map<string, CarryableDef>();
  protected carryRespawn = new Map<string, number>();
  protected clock_ = 0;

  protected abstract worldDef(): WorldDef;

  messages = {
    // ── relay: 클라 로컬 권위 상태 그대로 수용 (§14) ──
    avatar: (client: Client, m: Partial<PlayerState> & { tick?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      Object.assign(p, m);
    },
    // ── 이벤트: 클라 확정 → 서버 relay/확정 ──
    hitMonster: (client: Client, m: { monsterId: string; hitId: string }) => {
      const inst = this.monstersRt.get(m.monsterId);
      if (!inst) return;
      const died = registerHit(inst, `${client.sessionId}:${m.hitId}`);
      const ms = this.state.monsters.get(m.monsterId);
      if (ms) { ms.hitCount = inst.hits.size; if (died) ms.alive = false; }
    },
    breakBlock: (client: Client, m: { blockId: string; by: "headbutt" | "pound" | "shell" | "explosion" }) => {
      const b = this.blocksRt.get(m.blockId);
      if (!b) return;
      if (tryBreak(b, m.by)) {
        const bs = this.state.blocks.get(m.blockId);
        if (bs) bs.active = false;
      }
    },
    hitQBlock: (client: Client, m: { blockId: string }) => {
      const b = this.blocksRt.get(m.blockId);
      if (!b || b.emptied || !b.spec.emitsItem) return;
      b.emptied = true;
      const bs = this.state.blocks.get(m.blockId);
      if (bs) bs.emptied = true;
      // 랜덤 내용물 = 서버 확정 (§60)
      const assets = b.spec.emitsItem.assets;
      const kind = b.spec.emitsItem.random
        ? assets[Math.floor(Math.random() * assets.length)]
        : assets[0];
      const id = `qi_${m.blockId}`;
      const spec: ItemSpec = { id, kind: kind as ItemSpec["kind"], x: b.x + b.spec.w / 2, y: b.y - 4 };
      this.itemsRt.set(id, createItem(spec));
      const st = new ItemState();
      st.kind = spec.kind; st.x = spec.x; st.y = spec.y;
      this.state.items.set(id, st);
    },
    toggleSwitch: (_c: Client) => {
      this.state.switchOn = !this.state.switchOn;   // 상태 = 서버 권위 (§42)
    },
    // 잡기: 서버 소유권 확정 (선점 — §30-4 단순형). 실패 시 요청자에게 취소 통지
    grabObj: (client: Client, m: { objId: string }) => {
      const cs = this.state.carryables.get(m.objId);
      if (!cs || !cs.alive || cs.heldBy) {
        client.send("grabDenied", { objId: m.objId });
        return;
      }
      cs.heldBy = client.sessionId;
      const p = this.state.players.get(client.sessionId);
      if (p) p.holding = m.objId;
    },
    // 던지기: 소유 해제 → 발사체화 → 원위치 7.5초 재생 예약 (§30·§45)
    throwObj: (client: Client, m: { objId: string; x: number; y: number; vx: number; vy: number }) => {
      const cs = this.state.carryables.get(m.objId);
      if (!cs || cs.heldBy !== client.sessionId) return;
      cs.heldBy = "";
      cs.alive = false;
      this.carryRespawn.set(m.objId, TUNING.rules.respawnMs);
      const p = this.state.players.get(client.sessionId);
      if (p) p.holding = "";
      const spec: ProjectileSpec = {
        asset: "rock", trajectory: "arc", aim: "fixed",
        fixedDir: { x: m.vx, y: m.vy }, speed: "normal",
        pierce: false, onTerrain: "die", stompable: true, grabbable: true, effect: "knockback",
      };
      const pr = spawnProjectile(spec, m.x, m.y, m.vx >= 0 ? 1 : -1, undefined, undefined, client.sessionId);
      pr.body.vx = m.vx; pr.body.vy = m.vy;
      this.projectilesRt.set(pr.id, pr);
      const ps = new ProjectileState();
      ps.asset = "rock"; ps.x = pr.body.x; ps.y = pr.body.y;
      ps.vx = pr.body.vx; ps.vy = pr.body.vy;
      ps.stompable = true; ps.effect = "knockback"; ps.ownerId = client.sessionId;
      this.state.projectiles.set(pr.id, ps);
    },
    claimItem: (client: Client, m: { itemId: string }) => {
      this.claims.push({ itemId: m.itemId, sessionId: client.sessionId, at: this.clock_ });
    },
    throwItem: (client: Client, m: { itemId: string; x: number; y: number; vx: number; vy: number }) => {
      // 던짐 = 발사체화 (§30) — 소유 해제 + 서버 권위 발사체 생성
      const p = this.state.players.get(client.sessionId);
      if (p) p.holding = "";
      const spec: ProjectileSpec = {
        asset: m.itemId, trajectory: "arc", aim: "fixed",
        fixedDir: { x: m.vx, y: m.vy }, speed: "normal",
        pierce: false, onTerrain: "die", stompable: true, grabbable: true, effect: "knockback",
      };
      const pr = spawnProjectile(spec, m.x, m.y, m.vx >= 0 ? 1 : -1, undefined, undefined, client.sessionId);
      pr.body.vx = m.vx; pr.body.vy = m.vy;
      this.projectilesRt.set(pr.id, pr);
      const ps = new ProjectileState();
      ps.asset = spec.asset; ps.x = pr.body.x; ps.y = pr.body.y;
      ps.vx = pr.body.vx; ps.vy = pr.body.vy;
      ps.stompable = true; ps.effect = spec.effect; ps.ownerId = client.sessionId;
      this.state.projectiles.set(pr.id, ps);
    },
    // 개발 명령 (DEV 전용 — §32-3, 프로덕션 미등록은 호출부에서)
    tune: (_c: Client, m: { path: string; value: number }) => {
      if (typeof m?.path === "string" && typeof m?.value === "number" && applyTuning(m.path, m.value)) {
        this.broadcast("tune", m);
      }
    },
    tp: (client: Client, m: { x: number; y: number }) => {
      this.broadcast("tp", { sessionId: client.sessionId, x: m.x, y: m.y });
    },
  };

  onCreate(): void {
    this.setPatchRate(1000 / TUNING.net.sendRateHz);   // 상태 브로드캐스트 30Hz (기본 20Hz→끊김 완화)
    const def = this.worldDef();
    this.terrainBase = def.terrain;
    this.line = def.line;
    for (const bs of def.blocks) {
      this.blocksRt.set(bs.id, createBlock(bs));
      const st = new BlockState();
      st.x = bs.x; st.y = bs.y;
      this.state.blocks.set(bs.id, st);
    }
    for (const msSpec of def.monsters) {
      const inst = createMonster(msSpec);
      this.monstersRt.set(msSpec.id, inst);
      const st = new MonsterState();
      st.asset = msSpec.asset; st.x = msSpec.x; st.y = msSpec.y;
      st.w = msSpec.w; st.h = msSpec.h; st.hp = msSpec.hp;
      this.state.monsters.set(msSpec.id, st);
    }
    for (const cd of def.carryables ?? []) {
      this.carryDefs.set(cd.id, cd);
      const st = new CarryableState();
      st.x = cd.x; st.y = cd.y;
      this.state.carryables.set(cd.id, st);
    }
    for (const it of def.items) {
      this.itemsRt.set(it.id, createItem(it));
      const st = new ItemState();
      st.kind = it.kind; st.x = it.x; st.y = it.y;
      this.state.items.set(it.id, st);
    }

    let acc = 0;
    this.setSimulationInterval((dt) => {
      acc += dt;
      while (acc >= FIXED_MS) { acc -= FIXED_MS; this.fixedTick(); }
    });
  }

  /** 동적 블록 포함 현재 지형 */
  protected currentTerrain(): Terrain {
    const solids = [...this.terrainBase.solids];
    for (const [id, b] of this.blocksRt) {
      if (blockSolid(b, this.state.switchOn, this.clock_)) solids.push(blockRect(b));
      void id;
    }
    return { solids, slopes: this.terrainBase.slopes };
  }

  protected fixedTick(): void {
    this.clock_ += FIXED_MS;
    this.state.serverTime = this.clock_;
    const terrain = this.currentTerrain();

    // 서버가 아는 플레이어 Body (어그로·유도용 — relay된 최신값)
    const playerBodies = new Map<string, Body>();
    this.state.players.forEach((p, id) => {
      const b = createBody(p.x, p.y, p.w, p.h, ["player"]);
      b.vx = p.vx; b.vy = p.vy; b.facing = p.facing as 1 | -1;
      playerBodies.set(id, b);
    });
    const playerList = [...playerBodies.values()];

    // ── 몬스터 (서버 권위 §21) ──
    for (const [id, m] of this.monstersRt) {
      const st = this.state.monsters.get(id);
      if (!st) continue;
      const target = updateAggro(m, playerBodies, FIXED_MS);
      const emit = (kind: string, data: Record<string, unknown>) => {
        if (kind === "shoot") this.handleShoot(data);
        else if (kind === "windup") {
          st.windupAnim = String(data.anim ?? "windup.generic");
          st.windupEndsAt = this.clock_ + Number(data.ms ?? 0);   // 절대시각 (§23)
        } else if (kind === "stunned") st.stunned = true;
        else if (kind === "revived") st.stunned = false;
        else if (kind === "hide") st.hidden = true;
        else if (kind === "emerge") st.hidden = false;
      };
      stepMonster(m, target, playerList, terrain, FIXED_MS, Math.random, this.state.switchOn, emit);
      if (m.alive) {
        // 중력 + 이동 (behavior가 vx/vy 명령)
        if (m.body.gravity) m.body.vy = Math.min(m.body.vy + TUNING.gravity.base * (FIXED_MS / 1000), TUNING.gravity.maxFallSpeed);
        clampSpeed(m.body);
        const prevG = m.body.grounded;
        moveAndCollide(m.body, terrain, FIXED_MS);
        if (!prevG && m.body.grounded) m.events.add("landed");
        // 라인 이탈 = 사망 (§46)
        if (checkLineExit(m.body.x, this.line)) {
          m.alive = false; m.respawnLeftMs = TUNING.rules.respawnMs;
        }
      }
      st.x = m.body.x; st.y = m.body.y; st.vx = m.body.vx; st.vy = m.body.vy;
      st.facing = m.body.facing; st.alive = m.alive; st.hitCount = m.hits.size;
      if (st.windupEndsAt !== 0 && this.clock_ >= st.windupEndsAt) { st.windupAnim = ""; st.windupEndsAt = 0; }
    }

    // ── 이동 블록 (behavior 통합 §65 — 시간 결정론이지만 서버 계산으로 단순화) ──
    for (const [id, b] of this.blocksRt) {
      stepBlockRespawn(b, FIXED_MS);
      const st = this.state.blocks.get(id);
      if (!st) continue;
      if (b.spec.rules && b.state === "active") {
        const motionOk = !b.spec.switchReact || b.spec.switchReact.mode !== "motion"
          || this.state.switchOn === b.spec.switchReact.whenOn;
        if (motionOk) {
          const body = createBody(b.x + b.spec.w / 2, b.y + b.spec.h, b.spec.w, b.spec.h, ["block"]);
          body.gravity = false;
          body.facing = (b.mem["__facing"] ?? 1) as 1 | -1;
          const ctx: Ctx = {
            self: body, dtMs: FIXED_MS, t: TUNING, terrain: this.terrainBase,
            players: playerList, target: null, rng: Math.random,
            mem: b.mem, events: new Set(), emit: () => {},
            switchOn: this.state.switchOn, hpRatio: 1,
          };
          const rules = (b.mem["__compiled"] as unknown as ReturnType<typeof compileRules>) ?? null;
          const compiled = rules ?? compileRules(b.spec.rules);
          if (!rules) (b.mem as Record<string, unknown>)["__compiled"] = compiled as unknown as number;
          stepRules(compiled, ctx);
          body.x += body.vx * (FIXED_MS / 1000);
          body.y += body.vy * (FIXED_MS / 1000);
          b.mem["__facing"] = body.facing;
          b.x = body.x - b.spec.w / 2;
          b.y = body.y - b.spec.h;
        }
      }
      st.active = b.state === "active";
      st.visibleNow = blockSolid(b, this.state.switchOn, this.clock_);
      st.x = b.x; st.y = b.y; st.emptied = b.emptied;
    }

    // ── 발사체 (유도만 서버 의미, 나머지도 여기서 일괄) ──
    for (const [id, pr] of this.projectilesRt) {
      const st = this.state.projectiles.get(id);
      let homing: { x: number; y: number } | null = null;
      if (pr.spec.trajectory === "homing") {
        let nd = Infinity;
        for (const pb of playerList) {
          const d = Math.hypot(pb.x - pr.body.x, pb.y - pr.body.y);
          if (d < nd) { nd = d; homing = { x: pb.x, y: pb.y - pb.h / 2 }; }
        }
      }
      stepProjectile(pr, terrain, FIXED_MS, homing);
      if (checkLineExit(pr.body.x, this.line)) pr.alive = false;   // §46
      if (!pr.alive) {
        this.projectilesRt.delete(id);
        this.state.projectiles.delete(id);
      } else if (st) {
        st.x = pr.body.x; st.y = pr.body.y; st.vx = pr.body.vx; st.vy = pr.body.vy;
      }
    }

    // ── 잡기 파츠: 들려 있으면 소유자 위치 추종, 소멸 시 7.5초 재생 (§45) ──
    this.state.carryables.forEach((cs, id) => {
      if (cs.heldBy) {
        const holder = this.state.players.get(cs.heldBy);
        if (holder) {
          cs.x = holder.x + holder.facing * (holder.w / 2 + 20);
          cs.y = holder.y - holder.h * 0.3;
        } else {
          cs.heldBy = "";   // 소유자 이탈 → 그 자리에 낙하 상태로
        }
      }
      if (!cs.alive) {
        const left = (this.carryRespawn.get(id) ?? 0) - FIXED_MS;
        this.carryRespawn.set(id, left);
        if (left <= 0) {
          const def0 = this.carryDefs.get(id);
          if (def0) { cs.x = def0.x; cs.y = def0.y; }
          cs.alive = true;
          this.carryRespawn.delete(id);
        }
      }
    });

    // ── 아이템 재생성 + 경합 중재 (§60) ──
    for (const [id, it] of this.itemsRt) {
      const st = this.state.items.get(id);
      if (it.taken) {
        it.respawnLeftMs -= FIXED_MS;
        if (it.respawnLeftMs <= 0) { it.taken = false; if (st) st.available = true; }
      }
    }
    this.resolveClaims();
  }

  /** 경합 윈도우(2틱) 모아 도착 빠를수록 가중치 큰 랜덤 (§30-4·§60) */
  private resolveClaims(): void {
    if (this.claims.length === 0) return;
    const cutoff = this.clock_ - FIXED_MS * 2;
    const ready = this.claims.filter((c) => c.at <= cutoff);
    if (ready.length === 0) return;
    const byItem = new Map<string, Claim[]>();
    for (const c of ready) {
      const arr = byItem.get(c.itemId) ?? [];
      arr.push(c);
      byItem.set(c.itemId, arr);
    }
    for (const [itemId, cs] of byItem) {
      const it = this.itemsRt.get(itemId);
      if (!it || it.taken) {
        this.broadcastClaim(itemId, null);
        continue;
      }
      cs.sort((a, b) => a.at - b.at);
      // 가중치: 1등 n, 2등 n-1 ... (빠를수록 유리하되 100%는 아님)
      const weights = cs.map((_, i) => cs.length - i + 1);
      const total = weights.reduce((s, w) => s + w, 0);
      let r = Math.random() * total;
      let winner = cs[0];
      for (let i = 0; i < cs.length; i++) { r -= weights[i]; if (r <= 0) { winner = cs[i]; break; } }
      it.taken = true;
      it.respawnLeftMs = TUNING.rules.respawnMs;
      const st = this.state.items.get(itemId);
      if (st) st.available = false;
      this.broadcastClaim(itemId, winner.sessionId);
    }
    this.claims = this.claims.filter((c) => c.at > cutoff);
  }

  private broadcastClaim(itemId: string, winner: string | null): void {
    this.broadcast("itemClaim", { itemId, winner });
  }

  private handleShoot(data: Record<string, unknown>): void {
    const spec: ProjectileSpec = {
      asset: String(data.projectile ?? "default"),
      trajectory: (data.trajectory as ProjectileSpec["trajectory"]) ?? "straight",
      aim: (data.aim as ProjectileSpec["aim"]) ?? "facing",
      speed: (data.speed as ProjectileSpec["speed"]) ?? "normal",
      pierce: false, onTerrain: "die", stompable: true, grabbable: false, effect: "damage",
    };
    const pr = spawnProjectile(
      spec, Number(data.x), Number(data.y), (Number(data.facing) as 1 | -1) || 1,
      data.targetX as number | undefined, data.targetY as number | undefined, "",
    );
    this.projectilesRt.set(pr.id, pr);
    const ps = new ProjectileState();
    ps.asset = spec.asset; ps.x = pr.body.x; ps.y = pr.body.y;
    ps.vx = pr.body.vx; ps.vy = pr.body.vy; ps.stompable = spec.stompable; ps.effect = spec.effect;
    this.state.projectiles.set(pr.id, ps);
  }

  onJoin(client: Client, options: { nickname?: string } | undefined): void {
    const def = this.worldDef();
    const p = new PlayerState();
    p.x = def.spawn.x + Math.random() * 128;
    p.y = def.spawn.y;
    p.nickname = typeof options?.nickname === "string" ? options.nickname.slice(0, 12) : "";
    this.state.players.set(client.sessionId, p);
    console.log(`[room] join ${client.sessionId} (${this.state.players.size}명)`);
  }

  onLeave(client: Client): void {
    this.state.carryables.forEach((cs) => {
      if (cs.heldBy === client.sessionId) cs.heldBy = "";
    });
    this.state.players.delete(client.sessionId);
    console.log(`[room] leave ${client.sessionId} (${this.state.players.size}명)`);
  }
}
