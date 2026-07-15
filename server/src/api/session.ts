// 세션 API — 닉네임 → User 생성 + 토큰 발급(클라 localStorage 저장), 토큰 검증.
// 닉네임 중복 허용(식별은 token) — screen-design.md S1.
import { randomUUID } from "node:crypto";
import express, { Router, type Response } from "express";
import { prisma, jsonSafe } from "../prisma.js";
import { requireUser, type AuthedRequest } from "./auth.js";

export function sessionRouter(): Router {
  const r = Router();
  r.use(express.json());

  // 로그인: 닉네임 1~12자 → User 생성 + token 발급
  r.post("/api/session", async (req, res: Response) => {
    const nickname = typeof req.body?.nickname === "string" ? req.body.nickname.trim() : "";
    if (nickname.length < 1 || nickname.length > 12) {
      res.status(400).json({ error: "nickname must be 1~12 chars" });
      return;
    }
    const user = await prisma.user.create({
      data: { nickname, token: randomUUID() },
    });
    res.status(201).json(jsonSafe({ userId: user.id, token: user.token, nickname: user.nickname }));
  });

  // 재방문 검증: token → 유저 정보 (401이면 클라가 로그인 화면으로)
  r.get("/api/me", requireUser, async (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    res.json(jsonSafe({ userId: u.id, nickname: u.nickname, avatarAssetId: u.avatarAssetId }));
  });

  return r;
}
