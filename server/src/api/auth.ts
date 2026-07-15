// 유저 토큰 인증 미들웨어 — x-user-token 헤더로 User 조회, req.user 부착.
// 이후 lines/assets 등 유저 스코프 API가 공용으로 사용.
import type { Request, Response, NextFunction } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../prisma.js";

export interface AuthedRequest extends Request {
  user?: User;
}

export async function requireUser(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.header("x-user-token");
  if (!token) {
    res.status(401).json({ error: "x-user-token required" });
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
