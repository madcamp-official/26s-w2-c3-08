// 레이스 방 동기화 스키마 — GameState(물리) + 페이즈·명단.
// 페이즈 타이머의 단일 원천 = phaseEndsAt(serverTime 기준 절대시각, 0=무제한).
import { Schema, type, MapSchema } from "@colyseus/schema";
import { GameState } from "./GameState.js";

export class MemberState extends Schema {
  @type("string") userId = "";
  @type("string") nickname = "";
  @type("boolean") isHost = false;
  @type("boolean") canBuild = true;   // 난입 컷(잔여 제작시간 < 60s) 시 false
}

export class RaceState extends GameState {
  @type("string") phase = "lobby";
  @type("number") phaseEndsAt = 0;
  @type("uint8") lineCount = 0;       // racing 진입 시 확정 — 게임시간 = lineCount × 40s
  @type({ map: MemberState }) members = new MapSchema<MemberState>();
}
