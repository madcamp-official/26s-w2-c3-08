// RaceRoom — 페이즈 상태기계(lobby→preview→building→racing→finished) + DB Room/RoomMember 동기화.
// 물리는 PhysicsRoom 상속(2단계에선 빈 월드 — 3단계에서 racing 진입 시 병합맵 loadWorld).
// 실시간 상태의 원본은 Colyseus 메모리, DB는 기록용(쓰기 실패는 로그만 — schema.prisma 방침).
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Client } from "colyseus";
import type { User } from "@prisma/client";
import { GAME_RULES } from "shared";
import {
  type Phase, NEXT_PHASE, phaseDurationSec, RACE_MSG, RACE_S2C_MSG, type RaceJoinOptions,
} from "shared/race";
import { PhysicsRoom, type WorldDef } from "../base/PhysicsRoom.js";
import { RaceState, MemberState } from "../schema/RaceState.js";
import { prisma } from "../../prisma.js";
import { resolveMemberLines } from "../../game/resolveMemberLines.js";
import { mergeLines } from "../../game/mergeLines.js";

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
  /** racing 진입 시 확정되는 골 지점(타일) — 4단계 골 판정용 */
  protected goalFlagTiles: { x: number; y: number } | null = null;

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

    // DB Room 행 생성 (기록용, 비동기)
    this.roomCode = randomBytes(3).toString("hex");
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
  }

  // ── 페이즈 엔진 ─────────────────────────────────────
  protected override fixedTick(): void {
    super.fixedTick();
    if (!this.transitioning && this.state.phaseEndsAt > 0 && this.clock_ >= this.state.phaseEndsAt) {
      const next = NEXT_PHASE[this.state.phase as Phase];
      if (next) void this.enterPhase(next);
    }
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

    try {
      const { lines, fallbackUserIds } = await resolveMemberLines(this.roomCode, memberUserIds);
      shuffleInPlace(lines);
      const { worldDef, goalFlagTiles } = mergeLines(lines);
      this.loadWorld(worldDef);
      this.state.lineCount = lines.length;
      this.goalFlagTiles = goalFlagTiles;

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

  /** 4단계: 순위 확정·RaceResult 저장 */
  protected onEnterFinished(): void {}

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

    if (this.roomRowId !== null) {
      prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: this.roomRowId, userId: user.id } },
        create: { roomId: this.roomRowId, userId: user.id, canBuild: m.canBuild },
        update: { canBuild: m.canBuild },
      }).catch((e) => console.warn("[race] RoomMember 기록 실패:", e?.message ?? e));
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
  }
}
