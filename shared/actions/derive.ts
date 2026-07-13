// deriveActions — "카테고리 + attrs → 생성할 애니메이션 액션 세트" 파생 규칙의 단일 소스.
//
// 사용처가 세 곳이라 shared에 있다:
//  1) 클라 스튜디오: 옵션 폼 옆에 "생성될 애니메이션: idle, 걷기" 미리보기
//  2) 서버: 에셋 제출 시 AssetSprite 행 생성(액션당 1행) + 잡 큐 적재
//  3) 잡 페이로드: 액션별 {name, motionHint}가 그대로 gpu-worker로 전달 (워커는 이 파일을 모름 — 페이로드 주도)
//
// v1 규칙표 (2026-07-12 초안 — 옵션별 세부는 팀 확정 전, 조정은 이 파일만 수정):
//  - 모든 에셋: idle 1개 항상 (배경 잔디 흔들림도 idle 루프)
//  - 아바타: + walk, onair (player-spec.md 3액션)
//  - 몬스터: 이동 유형에 따라 + walk/fly/climb, 발사체 발사 시 + attack
//  - 플랫폼·장애물: idle만 — 왕복·회전·돌진·점멸은 코드가 스프라이트를 움직여 표현 (에셋 영상 아님)
//  - 아이템: 시스템 제공이므로 idle만 (시트도 시스템 시드)
import type { AttrsByCategory, Category, MonsterAttrs } from "../schemas/index.js";
import { ACTION, MOTION_HINT, type ActionName } from "./catalog.js";

export interface DerivedAction {
  name: ActionName;
  /** 영상 프롬프트의 모션 부분. 필요 시 attrs에 따라 강화(예: fast 보행 → briskly) */
  motionHint: string;
  loop: boolean;
}

function act(name: ActionName, hintOverride?: string): DerivedAction {
  return { name, motionHint: hintOverride ?? MOTION_HINT[name], loop: true };
}

export function deriveActions<C extends Category>(category: C, attrs: AttrsByCategory[C]): DerivedAction[] {
  const out: DerivedAction[] = [act(ACTION.idle)];

  switch (category) {
    case "avatar":
      out.push(act(ACTION.walk), act(ACTION.onair));
      break;

    case "monster": {
      const m = attrs as MonsterAttrs;
      switch (m.locomotion.type) {
        case "walk":
          out.push(
            act(
              ACTION.walk,
              m.locomotion.speed === "fast"
                ? "briskly walking in place, quick natural gait"
                : m.locomotion.speed === "slow"
                  ? "slowly trudging in place, heavy unhurried gait"
                  : undefined,
            ),
          );
          break;
        case "fly":
          out.push(act(ACTION.fly));
          break;
        case "climb":
          out.push(act(ACTION.climb));
          break;
        case "stationary":
          break; // idle만
      }
      if (m.shooter) out.push(act(ACTION.attack));
      break;
    }

    case "platform":
    case "obstacle":
    case "background":
    case "item":
      break; // idle만 — 움직임은 코드 담당 (장애물 회전·돌진 포함)
  }

  return out;
}
