// 스프라이트 뷰 — 지금까지 색 사각형(myRect 등)이 있던 자리에 이미지+윤곽 테두리를 얹는 헬퍼.
// 시트가 준비 안 됐으면 stepSpriteView가 false를 반환한다 — 호출부는 그동안 기존 Rectangle을
// 계속 보여주면 됨(§2026-07-16 설계: 폴백=사각형, 여기서 강제 전환 안 함).
// 테두리: getSpriteOutlineWorld가 현재 프레임 윤곽을 월드 좌표 폴리곤으로 반환하고,
// 면별 색 입히기는 visualLanguage.drawPolyFaceBorders가 담당(시각 언어 단일 소스 유지).
import Phaser from "phaser";
import type { ActionName } from "shared/actions";
import { SPRITE_PADDING_PX } from "shared";
import type { AssetManifest } from "./manifest.js";
import { queueManifestLoad, textureKey, sourceTextureKey, animKey, hasAnim } from "./load.js";
import { getOutlines, type Point } from "./outline.js";

export interface SpriteView {
  key: string | null;
  manifest: AssetManifest | null;
  sprite: Phaser.GameObjects.Sprite;
  lastAction: ActionName | null;
  /** true면 ①액션시트가 아니라 ②원본 정지그림을 보여주는 중(패딩=0 확정, 애니메이션 없음). */
  usingSource: boolean;
}

export function createSpriteView(scene: Phaser.Scene, depth: number): SpriteView {
  const sprite = scene.add.sprite(0, 0, "__DEFAULT").setVisible(false).setDepth(depth).setOrigin(0.5, 1);
  return { key: null, manifest: null, sprite, lastAction: null, usingSource: false };
}

export function destroySpriteView(view: SpriteView): void {
  view.sprite.destroy();
  view.key = null; view.manifest = null; view.lastAction = null; view.usingSource = false;
}

/** 이 뷰에 에셋을 배정 — 시트 로드를 큐에 올린다. 이미 같은 키면 중복 로드 안 함(load.ts가 가드). */
export function assignManifest(scene: Phaser.Scene, view: SpriteView, manifest: AssetManifest): void {
  view.key = manifest.key;
  view.manifest = manifest;
  queueManifestLoad(scene, manifest);
  if (!scene.load.isLoading()) scene.load.start();
}

/**
 * 프레임(패딩 포함)에서 실제 캐릭터가 차지하는 콘텐츠 크기와, 프레임 바닥→캐릭터 발 사이 여백(px).
 * 파이프라인이 사방 SPRITE_PADDING_PX 여백을 넣으므로 프레임 전체를 캐릭터로 취급하면 안 된다.
 * 여백을 벗길 수 없을 만큼 프레임이 작으면(옛 무패딩 시트 등) 패딩 0으로 폴백 — 프레임 전체=콘텐츠.
 */
function contentMetrics(fw: number, fh: number): { cw: number; ch: number; pad: number } {
  const pad = fw > SPRITE_PADDING_PX * 2 && fh > SPRITE_PADDING_PX * 2 ? SPRITE_PADDING_PX : 0;
  return { cw: fw - pad * 2, ch: fh - pad * 2, pad };
}

/**
 * 매 프레임 갱신. 준비된 액션이 없으면 스프라이트를 숨기고 false 반환(호출부가 폴백 사각형을
 * 켜야 함). action이 없으면 idle로 재시도, idle도 없으면 폴백.
 * dispW/dispH: 게임 히트박스 크기(px). 스프라이트는 이 히트박스에 "실제 캐릭터 부분(패딩 제외)"이
 *   맞도록 uniform 스케일(찌그러짐 없음)로 그리고, 패딩 여백은 그대로 둔 채(팔 등 안 잘림) 발끝을
 *   히트박스 바닥에 앵커한다. 콘텐츠 종횡비 = 히트박스 종횡비(둘 다 tilesW:tilesH)라 uniform이 맞다.
 */
export function stepSpriteView(
  scene: Phaser.Scene, view: SpriteView, action: ActionName,
  x: number, y: number, facing: 1 | -1, dispW: number, dispH: number, squashSy = 1,
): boolean {
  if (!view.key) { view.sprite.setVisible(false); return false; }
  const useAction: ActionName | null = hasAnim(scene, view.key, action) ? action
    : hasAnim(scene, view.key, "idle") ? "idle" : null;

  if (useAction) {
    if (view.usingSource || view.lastAction !== useAction) {
      view.sprite.play(animKey(view.key, useAction));
      view.lastAction = useAction;
      view.usingSource = false;
    }
    const fw = view.sprite.frame.cutWidth || 1, fh = view.sprite.frame.cutHeight || 1;
    const { ch, pad } = contentMetrics(fw, fh);
    // 콘텐츠(패딩 제외)를 히트박스에 맞추는 uniform 스케일. cw:ch == dispW:dispH라 한 축으로 계산해도
    // 다른 축이 자동으로 맞음(찌그러짐 없음). 세로 기준(발끝 위치가 중요)으로 잡는다.
    const scale = dispH / ch;
    view.sprite.setFlipX(facing < 0);
    // origin (0.5,1) = 프레임 바닥 앵커. 캐릭터 발은 프레임 바닥보다 pad(px)만큼 위 → 그만큼 아래로
    // 내려 앵커를 이동해 발끝이 정확히 y에 오게 한다(패딩만큼 공중에 뜨는 것 방지). squash 포함.
    view.sprite.setScale(scale, scale * squashSy);
    view.sprite.setPosition(x, y + pad * scale * squashSy);
    view.sprite.setVisible(true);
    return true;
  }

  // ②원본 정지그림 폴백 — ①이 하나도 없을 때만. 패딩은 추정하지 않고 0으로 확정(원본은 항상
  // bbox 타이트 크롭이라 여백이 없다는 게 설계상 보장됨 — §2026-07-16).
  const srcKey = sourceTextureKey(view.key);
  if (scene.textures.exists(srcKey)) {
    if (!view.usingSource) {
      view.sprite.anims.stop();
      view.sprite.setTexture(srcKey, "0");
      view.usingSource = true;
      view.lastAction = null;
    }
    const fh = view.sprite.frame.cutHeight || 1;
    const scale = dispH / fh;
    view.sprite.setFlipX(facing < 0);
    view.sprite.setScale(scale, scale * squashSy);
    view.sprite.setPosition(x, y);   // pad=0 확정이라 발끝 보정 불필요
    view.sprite.setVisible(true);
    return true;
  }

  view.sprite.setVisible(false);
  return false;
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
  if (!view.key) return null;
  if (view.usingSource) {
    // ②원본 — 1프레임 시트라 프레임 인덱스는 항상 0, 패딩도 항상 0(stepSpriteView와 동일 전제).
    const tKey = sourceTextureKey(view.key);
    const outlines = getOutlines(scene, tKey);
    const poly = outlines[0];
    if (!poly || poly.length < 3) return null;
    const frame = scene.textures.get(tKey).frames["0"];
    if (!frame) return null;
    const fw = frame.cutWidth, fh = frame.cutHeight;
    const scale = dispH / fh, sy = scale * squashSy;
    return poly.map((p) => {
      const lx = facing < 0 ? fw - p.x : p.x;
      return { x: x + (lx - fw / 2) * scale, y: y + (p.y - fh) * sy };
    });
  }
  if (!view.lastAction) return null;
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
  // stepSpriteView와 완전히 동일한 변환(uniform 스케일 + 발끝 앵커)이어야 테두리가 그림과 겹친다.
  const { ch, pad } = contentMetrics(fw, fh);
  const scale = dispH / ch, sy = scale * squashSy;
  const feetLocalY = fh - pad;   // 캐릭터 발끝 = 프레임 바닥에서 pad만큼 위
  return poly.map((p) => {
    const lx = facing < 0 ? fw - p.x : p.x;   // 좌우 반전
    return { x: x + (lx - fw / 2) * scale, y: y + (p.y - feetLocalY) * sy };
  });
}
