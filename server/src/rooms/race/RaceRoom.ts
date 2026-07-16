// RaceRoom — 페이즈 상태기계(lobby→preview→building→racing→finished) + DB Room/RoomMember 동기화.
// 물리는 PhysicsRoom 상속(2단계에선 빈 월드 — 3단계에서 racing 진입 시 병합맵 loadWorld).
// 실시간 상태의 원본은 Colyseus 메모리, DB는 기록용(쓰기 실패는 로그만 — schema.prisma 방침).
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Client } from "colyseus";
import type { User } from "@prisma/client";
import { GAME_RULES } from "shared";
import { TUNING } from "shared/physics";
import {
  type Phase, NEXT_PHASE, phaseDurationSec, RACE_MSG, RACE_S2C_MSG, type RaceJoinOptions,
  type AdjustTimePayload, type TimeAdjustedPayload,
  QUICK_HUB_MSG, QUICK_STOP_CHANNEL,
  flagpoleRect, overlapsFlagpole, sweepGroundSolids,
} from "shared/race";
import { PhysicsRoom, type WorldDef } from "../base/PhysicsRoom.js";
import { RaceState, MemberState } from "../schema/RaceState.js";
import { prisma } from "../../prisma.js";
import { resolveMemberLines } from "../../game/resolveMemberLines.js";
import { mergeLines, type MergedMap } from "shared/build";
import { QUICK_WORLD } from "shared/maps";

const T = TUNING.world.tileSize;
const RESPAWN_NOTIFY_COOLDOWN_MS = 1500;

function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}
function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return timingSafeEqual(scryptSync(pw, salt, 32), Buffer.from(hash, "hex"));
}

/** Fisher-Yates — 라인 병합 순서 랜덤화(게임 규칙: "테스트 완료된 라인끼리 랜덤 순서로 연결") */
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export class RaceRoom extends PhysicsRoom {
  maxClients = 8;
  state = new RaceState();

  private roomRowId: bigint | null = null;
  private roomCode = "";
  private hostSessionId = "";
  private passwordHash: string | null = null;
  private transitioning = false;
  private merged: MergedMap | null = null;
  private racingStartClock = 0;
  /** 간이 레이스 모드(콘솔 startstart 또는 허브 배차) — racing 진입 시 유저 라인 대신 고정 라인 세트 사용 */
  private quickMode = false;
  /** 허브 배차 방: 이 인원이 모이면 자동 시작 */
  private autoStartSize = 0;
  private autoStartTimer: NodeJS.Timeout | null = null;
  private onQuickStop: ((data: unknown) => void) | null = null;
  private lastRespawnNotifyAt = new Map<string, number>();

  /** 2단계: 빈 월드(로비엔 물리 대상 없음). 3단계에서 racing 진입 시 병합맵으로 교체. */
  protected worldDef(): WorldDef {
    return {
      terrain: { solids: [], slopes: [] },
      blocks: [], monsters: [], items: [],
      line: { startX: 0, endX: 10_000, index: 0 },
      spawn: { x: 128, y: 0 },
    };
  }

  override onCreate(options?: RaceJoinOptions): void {
    super.onCreate();
    if (options?.password) this.passwordHash = hashPassword(options.password);

    // 허브 배차 quick 방 — 고정 라인 + 인원 다 차면 자동 시작 + stop 전파 구독
    if (options?.quick) {
      this.quickMode = true;
      this.autoStartSize = Math.max(1, options.autoStartSize ?? 4);
      this.onQuickStop = () => {
        if (this.state.phase === "finished" || this.state.phase === "lobby") return;
        this.broadcast(QUICK_HUB_MSG.backToHub, {});
      };
      void this.presence.subscribe(QUICK_STOP_CHANNEL, this.onQuickStop);
      // 안전장치: 일부가 좌석을 소비 못 해도(새로고침 등) 6초 뒤 온 사람만으로 시작
      this.autoStartTimer = setTimeout(() => {
        if (this.state.phase === "lobby" && this.state.members.size >= 1) void this.enterPhase("racing");
      }, 6000);
    }

    // DB Room 행 생성 (기록용, 비동기). 방 목록은 REST(/api/rooms)가 이 테이블을 읽는다 —
    // Colyseus SDK(@colyseus/sdk 0.17)엔 getAvailableRooms가 없어 네이티브 매치메이킹 대신 이 방식.
    this.roomCode = randomBytes(3).toString("hex");
    this.state.code = this.roomCode;   // 클라 에디터가 라인 저장 시 sourceRoomId로 씀
    void (async () => {
      try {
        const creator = await prisma.user.findUnique({ where: { token: options?.userToken ?? "" } });
        const row = await prisma.room.create({
          data: {
            code: this.roomCode,
            name: options?.name ?? null,
            hostId: creator?.id ?? 0n,
            isPublic: options?.isPublic ?? true,
            passwordHash: this.passwordHash,
            maxPlayers: this.maxClients,
            status: "lobby",
            colyseusRoomId: this.roomId,
          },
        });
        this.roomRowId = row.id;
      } catch (e) {
        console.warn("[race] Room 행 생성 실패:", e instanceof Error ? e.message : e);
      }
    })();

    this.onMessage(RACE_MSG.start, (client) => {
      if (client.sessionId !== this.hostSessionId || this.state.phase !== "lobby") return;
      void this.enterPhase("preview");
    });
    this.onMessage(RACE_MSG.restart, (client) => {
      if (client.sessionId !== this.hostSessionId || this.state.phase !== "finished") return;
      void this.enterPhase("lobby");
    });
    // ── 간이 레이스 중단(레이스 방 안에서 stopstop) ──
    // 매칭 배차로 여러 방에 흩어져 있으므로, 한 방의 stopstop이 presence로 전체 quick 방에 전파된다.
    this.onMessage("stopstop", () => {
      if (!this.quickMode) return;
      console.log("[race] 간이 중단(전파)");
      void this.presence.publish(QUICK_STOP_CHANNEL, {});
    });

    // 시간조정(±30s) — building 한정, 플레이어당 평생 1회, 단축은 잔여 ≤45s면 거부(15s 미만 방지).
    this.onMessage(RACE_MSG.adjustTime, (client, msg: AdjustTimePayload) => {
      if (this.state.phase !== "building") return;
      const m = this.state.members.get(client.sessionId);
      if (!m || m.usedTimeAdjust) return;
      const dir = msg?.direction;
      if (dir !== "add" && dir !== "reduce") return;
      const leftMs = this.state.phaseEndsAt - this.clock_;
      if (dir === "reduce" && leftMs <= 45_000) return;
      this.state.phaseEndsAt += dir === "add" ? 30_000 : -30_000;
      m.usedTimeAdjust = true;
      this.broadcast(RACE_S2C_MSG.timeAdjusted, { nickname: m.nickname, direction: dir } satisfies TimeAdjustedPayload);
      console.log(`[race] 시간조정 ${m.nickname} ${dir} (잔여 ${Math.round((this.state.phaseEndsAt - this.clock_) / 1000)}s)`);
    });
  }

  // ── 페이즈 엔진 ─────────────────────────────────────
  protected override fixedTick(): void {
    super.fixedTick();
    if (this.state.phase === "racing" || this.state.phase === "lastdance") this.stepRaceProgress();

    if (!this.transitioning && this.state.phaseEndsAt > 0 && this.clock_ >= this.state.phaseEndsAt) {
      let next: Phase | undefined;
      if (this.state.phase === "racing") {
        // racing 종료 시 완주자 유무로 분기 (게임 규칙: 1등 없으면 라스트댄스)
        const anyFinished = [...this.state.members.values()].some((m) => m.rank > 0);
        next = anyFinished ? "finished" : "lastdance";
      } else {
        next = NEXT_PHASE[this.state.phase as Phase];
      }
      if (next) void this.enterPhase(next);
    }
  }

  /** racing·lastdance 매틱: 진행도 추적, 골 판정+카운트다운, 추락 리스폰, 파괴 스윕 */
  private stepRaceProgress(): void {
    if (!this.merged) return;
    const goalRect = flagpoleRect(this.merged.goalFlagTiles, T, true);
    let allFinished = this.state.members.size > 0;

    this.state.members.forEach((m, sessionId) => {
      const p = this.state.players.get(sessionId);
      if (!p) { allFinished = false; return; }
      if (p.x > m.bestX) m.bestX = p.x;

      if (m.rank === 0) {
        allFinished = false;
        if (!p.dead && overlapsFlagpole(p.x, p.y, p.w, p.h, goalRect)) {
          const finishedCount = [...this.state.members.values()].filter((x) => x.rank > 0).length;
          m.rank = finishedCount + 1;
          m.finishMs = this.clock_ - this.racingStartClock;
          if (m.rank === 1) {
            // 1등 도달 → 10초 카운트다운(남은 시간이 이미 더 짧으면 그대로 둠)
            this.state.phaseEndsAt = Math.min(this.state.phaseEndsAt, this.clock_ + GAME_RULES.finishCountdownSec * 1000);
          }
        }
      }

      if (p.y > this.merged!.fallY) {
        const last = this.lastRespawnNotifyAt.get(sessionId) ?? 0;
        if (this.clock_ - last >= RESPAWN_NOTIFY_COOLDOWN_MS) {
          this.lastRespawnNotifyAt.set(sessionId, this.clock_);
          const cp = this.checkpointFor(m.bestX);
          this.clients.find((c) => c.sessionId === sessionId)?.send(RACE_S2C_MSG.respawnAt, cp);
        }
      }
    });

    if (allFinished) this.state.phaseEndsAt = this.clock_;   // 전원 완주 → 즉시 종료

    // 파괴 스윕 — 라인당 sweepSec마다 순차
    const dueIndex = Math.floor((this.clock_ - this.racingStartClock) / (GAME_RULES.sweepSec * 1000));
    while (this.state.sweepIndex < dueIndex && this.state.sweepIndex < this.merged.lineFlags.length) {
      this.performSweep(this.state.sweepIndex);
    }
  }

  /** bestX가 지나온 라인 중 가장 최근 시작 깃발 좌표(px) — 체크포인트 리스폰 */
  private checkpointFor(bestX: number): { x: number; y: number } {
    let flag = this.merged!.startFlagTiles;
    for (const lf of this.merged!.lineFlags) {
      if (lf.start.x * T <= bestX) flag = lf.start; else break;
    }
    return { x: flag.x * T + T / 2, y: (flag.y + 1) * T };
  }

  /** 라인 index의 모든 블록·몬스터 파괴 + 시작·끝 깃발을 잇는 땅으로 대체 */
  private performSweep(index: number): void {
    if (!this.merged) return;
    const range = this.merged.lineRanges[index];
    const flags = this.merged.lineFlags[index];
    if (!range || !flags) return;
    const [xMin, xMax] = [range.startX * T, range.endX * T];

    for (const [id, b] of [...this.blocksRt]) {
      if (b.x >= xMin && b.x < xMax) { this.blocksRt.delete(id); this.state.blocks.delete(id); }
    }
    for (const [id, mo] of [...this.monstersRt]) {
      if (mo.body.x >= xMin && mo.body.x < xMax) { this.monstersRt.delete(id); this.state.monsters.delete(id); }
    }
    const ground = sweepGroundSolids(flags.start, flags.end, T);
    this.terrainBase = { solids: [...this.terrainBase.solids, ...ground], slopes: this.terrainBase.slopes };
    this.state.sweepIndex = index + 1;
    console.log(`[race] 라인 ${index} 스윕 완료`);
  }

  /**
   * 재진입 가드(transitioning): onEnterRacing이 DB 조회로 비동기 대기하는 동안
   * fixedTick이 매 틱 재호출하지 않도록. 그 사이엔 phaseEndsAt이 아직 안 갱신됐기 때문.
   */
  private async enterPhase(phase: Phase): Promise<void> {
    if (this.transitioning) return;
    this.transitioning = true;
    try {
      // 진입 훅 — lineCount는 racing 진입 전에 확정해야 duration 계산이 맞음
      if (phase === "racing") await this.onEnterRacing();

      this.state.phase = phase;
      if (phase === "racing") this.racingStartClock = this.clock_;
      const sec = phaseDurationSec(phase, this.state.lineCount);
      this.state.phaseEndsAt = sec === null ? 0 : this.clock_ + sec * 1000;
      console.log(`[race] phase → ${phase}${sec !== null ? ` (${sec}s)` : ""}`);

      if (phase === "building") this.onEnterBuilding();
      if (phase === "finished") this.onEnterFinished();

      // DB 기록 (비동기)
      if (this.roomRowId !== null) {
        prisma.room.update({
          where: { id: this.roomRowId },
          data: { status: phase, phaseStartedAt: new Date(), lineCount: this.state.lineCount || null },
        }).catch((e) => console.warn("[race] Room 상태 기록 실패:", e?.message ?? e));
      }
    } finally {
      this.transitioning = false;
    }
  }

  /** 3단계: 라인 할당·에디터 진입 준비 */
  protected onEnterBuilding(): void {}

  /**
   * 테스트 통과 라인 병합 → loadWorld. 본인 라인이 없는 유저는 DB 랜덤 라인으로 대체하고
   * 본인에게만 통지(lineFallback). 라인이 아무것도 없으면(시드 실패 등) 인원수로 폴백.
   */
  protected async onEnterRacing(): Promise<void> {
    const memberUserIds: bigint[] = [];
    const userIdToSessionId = new Map<string, string>();
    this.state.members.forEach((m, sessionId) => {
      memberUserIds.push(BigInt(m.userId));
      userIdToSessionId.set(m.userId, sessionId);
    });

    // 간이 레이스 — DB/에셋 파이프라인 전혀 안 씀. shared/maps/quickWorld.ts(TESTMAP과 동일 방식,
    // 리터럴 BlockSpec/MonsterSpec)를 그대로 this.merged로 쓴다. 클라도 같은 모듈을 import해서
    // 조립하므로(lineIds="quick" 센티널로 분기) 서버 왕복 없이 동일 월드가 보장된다(§14).
    if (this.quickMode) {
      this.merged = QUICK_WORLD;
      this.loadWorld(this.merged.worldDef);
      this.state.lineCount = this.merged.lineFlags.length;
      this.state.lineIds = "quick";
      this.state.sweepIndex = 0;
      this.state.goalX = this.merged.goalFlagTiles.x * T;
      this.state.members.forEach((m) => { m.rank = 0; m.finishMs = 0; m.bestX = this.merged!.worldDef.spawn.x; });
      this.lastRespawnNotifyAt.clear();
      console.log("[race] 간이 월드 로드 완료(quickWorld)");
      return;
    }

    try {
      const { lines, fallbackUserIds } = await resolveMemberLines(this.roomCode, memberUserIds);
      shuffleInPlace(lines);
      this.merged = mergeLines(lines);
      this.loadWorld(this.merged.worldDef);
      this.state.lineCount = lines.length;
      this.state.lineIds = lines.map((l) => l.id.toString()).join(",");   // 클라 월드 조립용(순서 보존)
      this.state.sweepIndex = 0;
      this.state.goalX = this.merged.goalFlagTiles.x * T;

      // 멤버 진행상태 초기화 (재대결 대비, 첫판이면 이미 기본값)
      this.state.members.forEach((m) => {
        m.rank = 0; m.finishMs = 0; m.bestX = this.merged!.worldDef.spawn.x;
      });
      this.lastRespawnNotifyAt.clear();

      for (const userId of fallbackUserIds) {
        const sessionId = userIdToSessionId.get(userId.toString());
        const client = sessionId ? this.clients.find((c) => c.sessionId === sessionId) : undefined;
        client?.send(RACE_S2C_MSG.lineFallback, { reason: "no_test_passed" });
      }
      console.log(`[race] 병합 완료 라인=${lines.length} 결손대체=${fallbackUserIds.length}`);
    } catch (e) {
      console.warn("[race] 라인 병합 실패, 인원수 폴백:", e instanceof Error ? e.message : e);
      this.state.lineCount = Math.max(1, this.state.members.size);
    }
  }

  /**
   * 순위 확정·RaceResult 저장. 완주자는 이미 rank·finishMs가 도달 순간 확정됨(§stepRaceProgress) —
   * 여기서는 미완주자(리타이어)에게 bestX 내림차순으로 이어지는 순번을 매긴다.
   * DB rank는 전원 순차 부여(1..N) — "1/2/3만 시상"은 조회 시 rank<=3으로 클라가 판단(스키마 rank는 not-null).
   */
  protected onEnterFinished(): void {
    let maxRank = 0;
    const results: { userId: bigint; finishMs: number | null; finalX: number | null; rank: number }[] = [];
    const unfinished: { sessionId: string; userId: bigint; bestX: number }[] = [];

    this.state.members.forEach((m, sessionId) => {
      const userId = BigInt(m.userId);
      if (m.rank > 0) {
        maxRank = Math.max(maxRank, m.rank);
        results.push({ userId, finishMs: m.finishMs, finalX: null, rank: m.rank });
      } else {
        unfinished.push({ sessionId, userId, bestX: m.bestX });
      }
    });
    unfinished.sort((a, b) => b.bestX - a.bestX);
    unfinished.forEach((u, i) => {
      const rank = maxRank + i + 1;
      const m = this.state.members.get(u.sessionId);
      if (m) m.rank = rank;
      results.push({ userId: u.userId, finishMs: null, finalX: Math.round(u.bestX), rank });
    });

    if (this.roomRowId !== null && results.length > 0) {
      const roomId = this.roomRowId;
      prisma.raceResult.createMany({
        data: results.map((r) => ({ roomId, userId: r.userId, finishMs: r.finishMs, finalX: r.finalX, rank: r.rank })),
      }).catch((e) => console.warn("[race] RaceResult 기록 실패:", e instanceof Error ? e.message : e));
    }
  }

  // ── 입장/퇴장 ───────────────────────────────────────
  async onAuth(client: Client, options: RaceJoinOptions): Promise<User> {
    if (this.state.phase === "racing" || this.state.phase === "finished") {
      throw new Error("레이스 진행 중인 방에는 입장할 수 없습니다");
    }
    if (this.passwordHash && this.clients.length > 0) {
      if (!options?.password || !verifyPassword(options.password, this.passwordHash)) {
        throw new Error("비밀번호가 틀렸습니다");
      }
    }
    const user = await prisma.user.findUnique({ where: { token: options?.userToken ?? "" } });
    if (!user) throw new Error("유효하지 않은 유저 토큰입니다");
    return user;
  }

  override onJoin(client: Client, options: { nickname?: string } | undefined): void {
    const user = client.auth as User;
    super.onJoin(client, { nickname: user.nickname, ...options });

    const m = new MemberState();
    m.userId = user.id.toString();
    m.nickname = user.nickname;
    if (!this.hostSessionId) {
      this.hostSessionId = client.sessionId;
      m.isHost = true;
    }
    // 난입 컷: 제작 잔여시간 < 60s면 이번 판 제작 불가 (관전)
    if (this.state.phase === "building") {
      const leftMs = this.state.phaseEndsAt - this.clock_;
      m.canBuild = leftMs >= GAME_RULES.joinCutoffSec * 1000;
    }
    this.state.members.set(client.sessionId, m);

    // 허브 배차 quick 방: 예정 인원이 다 모이면 즉시 자동 시작
    if (this.quickMode && this.autoStartSize > 0 && this.state.phase === "lobby"
        && this.state.members.size >= this.autoStartSize) {
      if (this.autoStartTimer) { clearTimeout(this.autoStartTimer); this.autoStartTimer = null; }
      void this.enterPhase("racing");
    }

    if (this.roomRowId !== null) {
      const roomRowId = this.roomRowId;
      prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: roomRowId, userId: user.id } },
        create: { roomId: roomRowId, userId: user.id, canBuild: m.canBuild },
        update: { canBuild: m.canBuild },
      }).catch((e) => console.warn("[race] RoomMember 기록 실패:", e?.message ?? e));
      prisma.room.update({ where: { id: roomRowId }, data: { memberCount: this.state.members.size } })
        .catch((e) => console.warn("[race] memberCount 갱신 실패:", e?.message ?? e));
    }
  }

  override onLeave(client: Client): void {
    super.onLeave(client);
    this.state.members.delete(client.sessionId);
    // 방장 이탈 → 남은 멤버 중 선착에게 위임
    if (client.sessionId === this.hostSessionId) {
      const next = this.state.members.keys().next();
      this.hostSessionId = next.done ? "" : next.value;
      if (!next.done) {
        const m = this.state.members.get(this.hostSessionId);
        if (m) m.isHost = true;
      }
    }
    if (this.roomRowId !== null) {
      prisma.room.update({ where: { id: this.roomRowId }, data: { memberCount: this.state.members.size } })
        .catch((e) => console.warn("[race] memberCount 갱신 실패:", e?.message ?? e));
    }
  }

  /**
   * 룸 프로세스 소멸 시(마지막 클라 퇴장 후 autoDispose) 방 목록(/api/rooms)에서 빠지게 status만
   * "closed"로 마킹 — 행 자체는 안 지움(RaceResult/RoomMember가 onDelete:Cascade라 완료된 게임
   * 기록까지 같이 삭제될 위험, 2026-07-16 발견: "0/8 방이 안 정리된다" 리포트로 onDispose 자체가
   * 없었던 게 드러남).
   */
  override onDispose(): void {
    if (this.autoStartTimer) { clearTimeout(this.autoStartTimer); this.autoStartTimer = null; }
    if (this.onQuickStop) { void this.presence.unsubscribe(QUICK_STOP_CHANNEL, this.onQuickStop); this.onQuickStop = null; }
    if (this.roomRowId !== null) {
      prisma.room.update({ where: { id: this.roomRowId }, data: { status: "closed" } })
        .catch((e) => console.warn("[race] 방 종료 마킹 실패:", e instanceof Error ? e.message : e));
    }
  }
}
