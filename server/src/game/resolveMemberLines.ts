// 방 멤버별 최종 라인 결정 — 본인이 이 방에서 테스트 통과시킨 최신 라인을 쓰되,
// 없으면(라인 미완성) DB 전체 테스트 통과 라인 중 랜덤 대체 + 결손 유저 목록 반환(호출부가 통지).
import { prisma } from "../prisma.js";
import type { LineWithPlacements } from "./loadLine.js";

const LINE_INCLUDE = { placements: { include: { asset: true } } } as const;

export interface ResolvedLines {
  /** 병합에 쓸 라인 목록(순서는 아직 랜덤화 전 — 호출부가 셔플) */
  lines: LineWithPlacements[];
  /** 대체된 유저 목록 (본인 라인 없음 → 통지 대상) */
  fallbackUserIds: bigint[];
}

/**
 * memberUserIds 각각에 대해:
 *  1) 이 방(roomCode)에서 본인이 만든 최신 testPassedAt 라인을 찾는다.
 *  2) 없으면 DB 전체(다른 방·다른 유저 포함) testPassedAt 라인 중 랜덤 1개로 대체.
 * 풀이 작아 대체 라인이 부족하면 중복 허용(best-effort로 명시).
 */
export async function resolveMemberLines(roomCode: string, memberUserIds: bigint[]): Promise<ResolvedLines> {
  const pool = await prisma.mapLine.findMany({
    where: { testPassedAt: { not: null } },
    include: LINE_INCLUDE,
  });
  if (pool.length === 0) throw new Error("테스트 통과 라인이 DB에 하나도 없습니다(시드 확인 필요)");

  const lines: LineWithPlacements[] = [];
  const fallbackUserIds: bigint[] = [];
  const usedIds = new Set<bigint>();

  for (const userId of memberUserIds) {
    const own = await prisma.mapLine.findFirst({
      where: { sourceRoomId: roomCode, creatorId: userId, testPassedAt: { not: null } },
      orderBy: { testPassedAt: "desc" },
      include: LINE_INCLUDE,
    });
    if (own) {
      lines.push(own);
      usedIds.add(own.id);
      continue;
    }
    fallbackUserIds.push(userId);
    const fresh = pool.filter((l) => !usedIds.has(l.id));
    const candidates = fresh.length > 0 ? fresh : pool;   // 풀 부족 시 중복 허용
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    lines.push(pick);
    usedIds.add(pick.id);
  }

  return { lines, fallbackUserIds };
}
