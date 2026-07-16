// 레이스 방 동기화 스키마 — GameState(물리) + 페이즈·명단.
// 페이즈 타이머의 단일 원천 = phaseEndsAt(serverTime 기준 절대시각, 0=무제한).
import { Schema, type, MapSchema } from "@colyseus/schema";
import { GameState } from "./GameState.js";

export class MemberState extends Schema {
  @type("string") userId = "";
  @type("string") nickname = "";
  @type("boolean") isHost = false;
  @type("boolean") canBuild = true;   // 난입 컷(잔여 제작시간 < 60s) 시 false
  @type("uint8") rank = 0;            // 0=미확정. 골 도달 순서 또는 라스트댄스 종료 시 거리순 배정
  @type("uint32") finishMs = 0;       // 완주 소요시간(racing 시작 기준). rank=0이면 무의미
  @type("number") bestX = 0;          // 진행 최고 x(px) — 체크포인트 리스폰·리타이어 순위 근거
  @type("boolean") usedTimeAdjust = false;   // 시간조정(±30s) 사용 여부 — 평생 1회(둘 중 하나)
}

export class RaceState extends GameState {
  @type("string") phase = "lobby";
  @type("string") code = "";          // 방 코드 — 에디터 라인 저장 시 sourceRoomId로 전달(본인 라인 매칭 근거)
  @type("number") phaseEndsAt = 0;
  @type("uint8") lineCount = 0;       // racing 진입 시 확정 — 게임시간 = lineCount × 40s
  @type("string") lineIds = "";       // 병합에 쓴 라인 id CSV(셔플된 순서 그대로) — 클라가 같은 월드를 조립(§14)
  @type("uint8") sweepIndex = 0;      // 파괴된 라인 수(0부터 순차)
  @type("number") goalX = 0;          // 골 x(px) — HUD 진행률용
  @type({ map: MemberState }) members = new MapSchema<MemberState>();
}
