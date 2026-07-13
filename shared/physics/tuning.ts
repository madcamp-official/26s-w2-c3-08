// tuning.json 로더. 모든 조작감·게임 수치의 유일한 원천 (코드 하드코딩 금지).
// 수치는 baseTile=64px 기준으로 작성. tileSize를 바꾸면 "길이 계열"(px·px/s·px/s²)만
// tileSize/baseTile로 비례 스케일한다(§tileSize). 시간(ms)·비율·빈도는 그대로.
import raw from "./tuning.json" with { type: "json" };

export type Tuning = typeof raw;

const BASE_TILE = 64;
/** tileSize에 비례하는 길이 계열 필드 경로. 여기에 없는 값(ms·비율·tickRate·tile단위)은 스케일 제외. */
const LENGTH_PATHS: readonly string[] = [
  "world.maxSpeed",
  "gravity.base", "gravity.maxFallSpeed",
  "run.accel", "run.decel", "run.walkSpeed", "run.runSpeed",
  "jump.velocity",
  "wallSlide.grabMaxFall", "wallSlide.maxFall", "wallSlide.kickVx", "wallSlide.kickVy",
  "slide.accel", "slide.maxSpeed", "slide.flatDecel", "slide.exitSpeed", "slide.crouchMinSpeed", "slide.slopeStartSpeed",
  "pound.riseVelocity", "pound.fallVelocity", "pound.minHeightPx",
  "stomp.minFallSpeed", "stomp.downVelocity", "stomp.bounceVelocity", "stomp.headBandPx", "stomp.poundBounceVelocity",
  "push.separatePerTick", "push.contactPad", "push.velThreshold",
  "corner.footSnapPx", "corner.headSnapPx",
  "sizeStage.smallW", "sizeStage.smallH",
  "sizes.projectile", "sizes.item", "sizes.carryable", "sizes.handOffset",
  "carry.throwSpeed", "carry.upThrowSpeed",
  "item.knockbackVx", "item.knockbackVy",
  "projectile.slowSpeed", "projectile.normalSpeed", "projectile.fastSpeed",
  "detect.nearPx", "detect.normalPx", "detect.farPx",
];

function scaleLengths(t: Tuning): void {
  const factor = t.world.tileSize / BASE_TILE;
  if (factor === 1) return;
  const root = t as unknown as Record<string, Record<string, number>>;
  for (const path of LENGTH_PATHS) {
    const [grp, key] = path.split(".");
    if (root[grp] && typeof root[grp][key] === "number") root[grp][key] *= factor;
  }
}

export const TUNING: Tuning = raw;
scaleLengths(TUNING);   // 로드 시 1회: tileSize≠64면 길이 계열 비례

// 스케일 적용 후 기본값 스냅샷 — tune으로 바꾼 변경점 추적용 (tunediff)
const DEFAULTS = JSON.parse(JSON.stringify(TUNING)) as Record<string, Record<string, number>>;

/** 기본값 대비 tune으로 바뀐 수치만 반환 (tuning.json 반영용) */
export function tuningDiff(): { path: string; from: number; to: number }[] {
  const cur = TUNING as unknown as Record<string, Record<string, number>>;
  const out: { path: string; from: number; to: number }[] = [];
  for (const g of Object.keys(cur)) {
    for (const k of Object.keys(cur[g])) {
      if (typeof cur[g][k] === "number" && cur[g][k] !== DEFAULTS[g]?.[k]) {
        out.push({ path: `${g}.${k}`, from: DEFAULTS[g][k], to: cur[g][k] });
      }
    }
  }
  return out;
}

/** 개발용 런타임 튜닝: "jump.velocity" 경로의 숫자를 덮어씀. 성공 여부 반환 */
export function applyTuning(path: string, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const keys = path.split(".");
  let obj: Record<string, unknown> = TUNING as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) {
    const next = obj[k];
    if (typeof next !== "object" || next === null) return false;
    obj = next as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (typeof obj[last] !== "number") return false;
  obj[last] = value;
  return true;
}
