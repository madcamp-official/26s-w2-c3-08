// 매니페스트 → Phaser 텍스처+애니메이션 등록. 시트가 없거나 로드 실패한 액션은 조용히 스킵
// (호출부가 폴백=사각형을 유지) — 여기서 throw하지 않는다(§2026-07-16 설계: 폴백 보장).
import Phaser from "phaser";
import { TUNING } from "shared/physics";
import { ACTIONS, type ActionName } from "shared/actions";
import type { AssetManifest } from "./manifest.js";
import { HTTP_BASE } from "../net/rest.js";

export function textureKey(assetKey: string, action: ActionName): string {
  return `spr:${assetKey}:${action}`;
}
export function animKey(assetKey: string, action: ActionName): string {
  return `anim:${assetKey}:${action}`;
}
/** 원본 정지그림(폴백②) 전용 텍스처 키 — 액션 네임스페이스와 분리. */
export function sourceTextureKey(assetKey: string): string {
  return `spr:${assetKey}:__source`;
}

/** 이미 로드된 에셋 키 집합 — 같은 매니페스트로 중복 로드 방지 (씬 재시작 시에도 안전) */
const loadedAssetKeys = new Set<string>();

/**
 * 매니페스트의 모든 액션 시트를 로드 큐에 올리고, load 완료 시 애니메이션을 등록한다.
 * scene.load.start()는 호출부(BaseworldScene의 preload 또는 즉시 시작 로더)가 책임진다 —
 * 이미 러닝 중인 로더에 얹는 경우 start() 재호출 불필요.
 */
export function queueManifestLoad(scene: Phaser.Scene, manifest: AssetManifest): void {
  if (loadedAssetKeys.has(manifest.key)) return;
  loadedAssetKeys.add(manifest.key);
  const actions = Object.entries(manifest.actions) as [ActionName, NonNullable<AssetManifest["actions"][ActionName]>][];
  for (const [action, sheet] of actions) {
    const tKey = textureKey(manifest.key, action);
    if (scene.textures.exists(tKey)) continue;
    const url = sheet.url.startsWith("http") ? sheet.url : `${HTTP_BASE}${sheet.url}`;
    scene.load.spritesheet(tKey, url, { frameWidth: sheet.frameW, frameHeight: sheet.frameH });
  }
  // 원본(폴백②) — 패딩 없는 정지그림 1장을 1프레임 시트로 로드(outline.ts가 시트 프레임만 인식하므로
  // load.image가 아니라 spritesheet로. 크기는 서버가 타일수 기반으로 확정해 내려준 값 — 추정 아님).
  if (manifest.sourceImage) {
    const srcKey = sourceTextureKey(manifest.key);
    if (!scene.textures.exists(srcKey)) {
      const url = manifest.sourceImage.url.startsWith("http") ? manifest.sourceImage.url : `${HTTP_BASE}${manifest.sourceImage.url}`;
      const T = TUNING.world.tileSize;
      scene.load.spritesheet(srcKey, url, {
        frameWidth: manifest.sourceImage.tilesW * T,
        frameHeight: manifest.sourceImage.tilesH * T,
      });
    }
  }
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => registerAnims(scene, manifest));
}

function registerAnims(scene: Phaser.Scene, manifest: AssetManifest): void {
  const actions = Object.entries(manifest.actions) as [ActionName, NonNullable<AssetManifest["actions"][ActionName]>][];
  for (const [action, sheet] of actions) {
    const tKey = textureKey(manifest.key, action);
    if (!scene.textures.exists(tKey)) continue;   // 로드 실패(404 등) — 조용히 스킵, 폴백 유지
    const aKey = animKey(manifest.key, action);
    if (scene.anims.exists(aKey)) continue;
    const spec = ACTIONS[action];
    // 아바타 idle 첫 프레임 스킵(요청 2026-07-16) — 생성물 프레임0이 정지 소스에 가까워 뻣뻣.
    const start = manifest.category === "avatar" && action === "idle" && sheet.frameCount > 1 ? 1 : 0;
    const nFrames = sheet.frameCount - start;
    scene.anims.create({
      key: aKey,
      frames: scene.anims.generateFrameNumbers(tKey, { start, end: sheet.frameCount - 1 }),
      frameRate: nFrames / (spec.durationSec ?? (spec.loop ? 3 : 1.5)),
      repeat: spec.loop ? -1 : 0,
    });
  }
}

/** 이 에셋의 이 액션이 로드·재생 가능한 상태인가 (폴백 판단용) */
export function hasAnim(scene: Phaser.Scene, assetKey: string, action: ActionName): boolean {
  return scene.anims.exists(animKey(assetKey, action));
}
