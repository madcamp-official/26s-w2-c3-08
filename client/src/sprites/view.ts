// 스프라이트 뷰 — 지금까지 색 사각형(myRect 등)이 있던 자리에 이미지+윤곽 테두리를 얹는 헬퍼.
// 시트가 준비 안 됐으면 stepSpriteView가 false를 반환한다 — 호출부는 그동안 기존 Rectangle을
// 계속 보여주면 됨(§2026-07-16 설계: 폴백=사각형, 여기서 강제 전환 안 함).
// 테두리: getSpriteOutlineWorld가 현재 프레임 윤곽을 월드 좌표 폴리곤으로 반환하고,
// 면별 색 입히기는 visualLanguage.drawPolyFaceBorders가 담당(시각 언어 단일 소스 유지).
import Phaser from "phaser";
import type { ActionName } from "shared/actions";
import type { AssetManifest } from "./manifest.js";
import { queueManifestLoad, textureKey, animKey, hasAnim } from "./load.js";
import { getOutlines, type Point } from "./outline.js";

export interface SpriteView {
  key: string | null;
  manifest: AssetManifest | null;
  sprite: Phaser.GameObjects.Sprite;
  lastAction: ActionName | null;
}

export function createSpriteView(scene: Phaser.Scene, depth: number): SpriteView {
  const sprite = scene.add.sprite(0, 0, "__DEFAULT").setVisible(false).setDepth(depth).setOrigin(0.5, 1);
  return { key: null, manifest: null, sprite, lastAction: null };
}

export function destroySpriteView(view: SpriteView): void {
  view.sprite.destroy();
  view.key = null; view.manifest = null; view.lastAction = null;
}

/** 이 뷰에 에셋을 배정 — 시트 로드를 큐에 올린다. 이미 같은 키면 중복 로드 안 함(load.ts가 가드). */
export function assignManifest(scene: Phaser.Scene, view: SpriteView, manifest: AssetManifest): void {
  view.key = manifest.key;
  view.manifest = manifest;
  queueManifestLoad(scene, manifest);
  if (!scene.load.isLoading()) scene.load.start();
}

/**
 * 매 프레임 갱신. 준비된 액션이 없으면 스프라이트를 숨기고 false 반환(호출부가 폴백 사각형을
 * 켜야 함). action이 없으면 idle로 재시도, idle도 없으면 폴백.
 * dispW/dispH: 게임 히트박스 크기(px) — 프레임 원본 크기와 무관하게 이 크기로 표시(블록 등).
 */
export function stepSpriteView(
  scene: Phaser.Scene, view: SpriteView, action: ActionName,
  x: number, y: number, facing: 1 | -1, dispW: number, dispH: number, squashSy = 1,
): boolean {
  if (!view.key) { view.sprite.setVisible(false); return false; }
  const useAction: ActionName | null = hasAnim(scene, view.key, action) ? action
    : hasAnim(scene, view.key, "idle") ? "idle" : null;
  if (!useAction) { view.sprite.setVisible(false); return false; }
  if (view.lastAction !== useAction) {
    view.sprite.play(animKey(view.key, useAction));
    view.lastAction = useAction;
  }
  view.sprite.setPosition(x, y);
  view.sprite.setFlipX(facing < 0);
  const fw = view.sprite.frame.cutWidth || 1, fh = view.sprite.frame.cutHeight || 1;
  view.sprite.setScale(dispW / fw, (dispH / fh) * squashSy);
  view.sprite.setVisible(true);
  return true;
}

/**
 * 현재 재생 중인 프레임의 윤곽 폴리곤을 월드 좌표로 변환해 반환(면별 색은 호출부가
 * drawPolyFaceBorders로). 캐싱 전·프레임 미확정이면 null(호출부가 사각 테두리 폴백).
 * 좌표계: (x, y) = 바닥-중앙 앵커(origin 0.5, 1 — stepSpriteView와 동일해야 함).
 */
export function getSpriteOutlineWorld(
  scene: Phaser.Scene, view: SpriteView,
  x: number, y: number, facing: 1 | -1, dispW: number, dispH: number, squashSy = 1,
): Point[] | null {
  if (!view.key || !view.lastAction) return null;
  const tKey = textureKey(view.key, view.lastAction);
  const outlines = getOutlines(scene, tKey);
  if (outlines.length === 0) return null;
  const frameName = view.sprite.anims.currentFrame?.textureFrame;
  const frameIdx = frameName !== undefined ? Number(frameName) : 0;
  const poly = outlines[frameIdx];
  if (!poly || poly.length < 3) return null;
  const frame = scene.textures.get(tKey).frames[String(frameIdx)];
  if (!frame) return null;
  const fw = frame.cutWidth, fh = frame.cutHeight;
  const sx = dispW / fw, sy = (dispH / fh) * squashSy;
  return poly.map((p) => {
    const lx = facing < 0 ? fw - p.x : p.x;   // 좌우 반전
    return { x: x + (lx - fw / 2) * sx, y: y + (p.y - fh) * sy };
  });
}
