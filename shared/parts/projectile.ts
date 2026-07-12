// 발사체 파츠 (§54): 궤적×발사방향 + 파츠 공통 축 재사용.
// 직선·포물선·겨냥 = 결정론 로컬. 유도만 서버 권위.
import { TUNING, type Tuning } from "../physics/tuning.js";
import { type Body, createBody, moveAndCollide } from "../physics/body.js";
import type { Terrain } from "../physics/terrain.js";
import { speedPreset } from "../behavior/helpers.js";

export type Trajectory = "straight" | "arc" | "homing";
export type AimMode = "fixed" | "atPlayer" | "facing";

export interface ProjectileSpec {
  asset: string;
  trajectory: Trajectory;
  aim: AimMode;
  fixedDir?: { x: number; y: number };
  speed: "slow" | "normal" | "fast";
  pierce: boolean;                      // 관통 (§54)
  onTerrain: "die" | "bounce";
  lifeMs?: number;
  stompable: boolean;                   // 실탄형=밟기 처치 / 에너지형=불가
  grabbable: boolean;                   // 밥옴류
  effect: "damage" | "kill" | "knockback";
}

export interface ProjectileInstance {
  id: string;
  spec: ProjectileSpec;
  body: Body;
  lifeLeftMs: number;
  ownerId: string;            // 자책 방지 판정용 (§30-1)
  alive: boolean;
}

let seq = 0;
export function spawnProjectile(
  spec: ProjectileSpec, x: number, y: number, facing: 1 | -1,
  targetX?: number, targetY?: number, ownerId = "", t: Tuning = TUNING,
): ProjectileInstance {
  const b = createBody(x, y + 8, t.world.tileSize / 2, t.world.tileSize / 2, ["projectile"]);
  const v = speedPreset(spec.speed, t);
  if (spec.aim === "atPlayer" && targetX !== undefined && targetY !== undefined) {
    const dx = targetX - x, dy = targetY - y;
    const m = Math.hypot(dx, dy) || 1;
    b.vx = (dx / m) * v; b.vy = (dy / m) * v;
  } else if (spec.aim === "fixed" && spec.fixedDir) {
    const m = Math.hypot(spec.fixedDir.x, spec.fixedDir.y) || 1;
    b.vx = (spec.fixedDir.x / m) * v; b.vy = (spec.fixedDir.y / m) * v;
  } else {
    b.vx = facing * v; b.vy = 0;
  }
  b.gravity = spec.trajectory === "arc";
  b.facing = facing;
  return { id: "pr" + seq++, spec, body: b, lifeLeftMs: spec.lifeMs ?? t.projectile.lifeMs, ownerId, alive: true };
}

/** 매 틱. 유도는 서버에서만 target 전달(§54 네트워크) */
export function stepProjectile(
  p: ProjectileInstance, terrain: Terrain, dtMs: number,
  homingTarget: { x: number; y: number } | null, t: Tuning = TUNING,
): void {
  if (!p.alive) return;
  const b = p.body;
  if (p.spec.trajectory === "homing" && homingTarget) {
    const desired = Math.atan2(homingTarget.y - b.y, homingTarget.x - b.x);
    const cur = Math.atan2(b.vy, b.vx);
    const v = Math.hypot(b.vx, b.vy);
    const na = cur + (desired - cur) * t.projectile.homingStrength; // 약한 유도 = 회피 가능
    b.vx = Math.cos(na) * v; b.vy = Math.sin(na) * v;
  }
  if (b.gravity) b.vy += t.gravity.base * (dtMs / 1000);
  const px = b.x, py = b.y;
  moveAndCollide(b, terrain, dtMs, t);
  const blocked = (b.vx === 0 && Math.abs(px - b.x) < 0.01) || b.grounded || b.touchingWall !== 0;
  if (blocked && p.spec.trajectory !== "arc") {
    if (p.spec.onTerrain === "die") p.alive = false;
    else { b.vx = -b.vx; b.facing = (-b.facing) as 1 | -1; }
  }
  void py;
  p.lifeLeftMs -= dtMs;
  if (p.lifeLeftMs <= 0) p.alive = false;
}
