// 유저 토큰 인증 미들웨어 — Authorization: Bearer 헤더(우선) 또는 x-user-token(하위호환)으로
// User 조회, req.user 부착. 이후 lines/assets 등 유저 스코프 API가 공용으로 사용.
// Bearer 우선인 이유: 배포 환경(Cloudflare Tunnel)의 프리플라이트 기본 Allow-Headers에
// Authorization은 있지만 커스텀 헤더(x-user-token)는 없어 크로스오리진에서 막힘(2026-07-16).
import type { Request, Response, NextFunction } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../prisma.js";

export interface AuthedRequest extends Request {
  user?: User;
}

function extractToken(req: Request): string | undefined {
  const auth = req.header("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.header("x-user-token") ?? undefined;
}

export async function requireUser(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "인증 토큰이 필요합니다" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { token } });
  if (!user) {
    res.status(401).json({ error: "invalid token" });
    return;
  }
  req.user = user;
  next();
}
