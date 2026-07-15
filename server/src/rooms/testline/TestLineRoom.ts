// TestLineRoom — 자기 라인 혼자 테스트(제작 페이즈 [테스트하기] / 개인 검증).
// 완주 판정 = 골 깃대 접촉(shared/race flagpole — 클라 연출과 같은 계약).
// 완주 시 MapLine.testPassedAt 갱신(가장 최근 성공본이 유효 — 게임 규칙).
// 추락사(fallY 아래)는 서버가 respawnAt으로 통지 — 클라가 그 좌표로 리스폰(정확한 라인 스폰).
import type { Client } from "colyseus";
import type { User } from "@prisma/client";
import { TUNING } from "shared/physics";
import { mergeLines, type MergedMap } from "shared/build";
import {
  flagpoleRect, overlapsFlagpole, TESTLINE_MSG, type TestlineJoinOptions,
} from "shared/race";
import { PhysicsRoom, type WorldDef } from "../base/PhysicsRoom.js";
import { prisma } from "../../prisma.js";

const RESPAWN_NOTIFY_COOLDOWN_MS = 1500;

export class TestLineRoom extends PhysicsRoom {
  maxClients = 1;   // 혼자 테스트 전용

  private lineId!: bigint;
  private merged!: MergedMap;
  private passed = false;
  private lastRespawnNotifyAt = new Map<string, number>();

  protected worldDef(): WorldDef {
    return this.merged.worldDef;
  }

  async onAuth(_client: Client, options: TestlineJoinOptions): Promise<User> {
    const user = await prisma.user.findUnique({ where: { token: options?.userToken ?? "" } });
    if (!user) throw new Error("유효하지 않은 유저 토큰입니다");
    return user;
  }

  override async onCreate(options?: TestlineJoinOptions): Promise<void> {
    if (!options?.lineId) throw new Error("lineId가 필요합니다");
    this.lineId = BigInt(options.lineId);
    const line = await prisma.mapLine.findUnique({
      where: { id: this.lineId },
      include: { placements: { include: { asset: true } } },
    });
    if (!line) throw new Error(`라인이 없습니다: ${options.lineId}`);
    this.merged = mergeLines([line]);
    super.onCreate();
    console.log(`[testline] 라인 ${this.lineId} 로드 — 폭 ${line.tileLength}타일, 배치 ${line.placements.length}개`);
  }

  protected override fixedTick(): void {
    super.fixedTick();
    const T = TUNING.world.tileSize;
    const goalRect = flagpoleRect(this.merged.goalFlagTiles, T, true);

    this.state.players.forEach((p, sessionId) => {
      if (p.dead) return;

      // ── 골 깃대 접촉 = 완주 확정 (접촉 순간이 기록 시점 — 하강 연출은 클라) ──
      if (!this.passed && overlapsFlagpole(p.x, p.y, p.w, p.h, goalRect)) {
        this.passed = true;
        prisma.mapLine.update({ where: { id: this.lineId }, data: { testPassedAt: new Date() } })
          .then(() => console.log(`[testline] 라인 ${this.lineId} 테스트 통과 기록`))
          .catch((e) => console.warn("[testline] testPassedAt 기록 실패:", e?.message ?? e));
        this.clients.find((c) => c.sessionId === sessionId)
          ?.send(TESTLINE_MSG.testPassed, { lineId: this.lineId.toString() });
      }

      // ── 추락사 → 정확한 라인 스폰 좌표로 리스폰 통지 ──
      if (p.y > this.merged.fallY) {
        const last = this.lastRespawnNotifyAt.get(sessionId) ?? 0;
        if (this.clock_ - last >= RESPAWN_NOTIFY_COOLDOWN_MS) {
          this.lastRespawnNotifyAt.set(sessionId, this.clock_);
          this.clients.find((c) => c.sessionId === sessionId)
            ?.send(TESTLINE_MSG.respawnAt, { x: this.merged.worldDef.spawn.x, y: this.merged.worldDef.spawn.y });
        }
      }
    });
  }

  override onJoin(client: Client, options: { nickname?: string } | undefined): void {
    const user = client.auth as User;
    super.onJoin(client, { nickname: user.nickname, ...options });
    // 재시도(재입장) 시 새로 판정할 수 있게 리셋 — 최근 성공본이 유효하므로 기존 기록은 유지
    this.passed = false;
  }
}
