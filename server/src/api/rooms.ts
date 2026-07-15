// 로비 방 목록 API — @colyseus/sdk 0.17엔 네이티브 매치메이킹 목록 조회가 없어(getAvailableRooms
// 부재 확인됨) DB Room 테이블(RaceRoom이 생성·갱신)을 REST로 노출한다. 비밀방도 포함(코드로 찾아 입장) —
// 클라가 isPublic으로 공개방만 골라 보여준다. colyseusRoomId로 joinById.
import { Router, type Response } from "express";
import type { RoomListing } from "shared/race";
import { prisma } from "../prisma.js";

export function roomsRouter(): Router {
  const r = Router();

  r.get("/api/rooms", async (_req, res: Response) => {
    // hostId는 scalar(관계 미연결, schema.prisma 주석) — 닉네임은 별도 조회해 합친다.
    const rooms = await prisma.room.findMany({
      // status="closed" = 룸 프로세스 소멸(RaceRoom.onDispose)로 정리된 방 — 목록에서 제외.
      where: { colyseusRoomId: { not: null }, status: { not: "closed" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const hostIds = [...new Set(rooms.map((r) => r.hostId))];
    const hosts = await prisma.user.findMany({ where: { id: { in: hostIds } }, select: { id: true, nickname: true } });
    const hostNicknameById = new Map(hosts.map((h) => [h.id.toString(), h.nickname]));

    const listing: RoomListing[] = rooms.map((room) => ({
      colyseusRoomId: room.colyseusRoomId!,
      code: room.code,
      name: room.name,
      hostNickname: hostNicknameById.get(room.hostId.toString()) ?? "",
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      memberCount: room.memberCount,
      status: room.status,
      phaseStartedAt: room.phaseStartedAt ? room.phaseStartedAt.toISOString() : null,
    }));
    res.json(listing);
  });

  return r;
}
