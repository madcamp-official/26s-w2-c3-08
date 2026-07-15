// 파티클용 소형 텍스처를 코드로 생성 (에셋 무의존). 부팅 시 1회.
import Phaser from "phaser";

export const FX_TEX = {
  glow: "fx-glow",     // 부드러운 발광 원 (additive용)
  spark: "fx-spark",   // 밝은 작은 점
  debris: "fx-debris", // 파편 사각
} as const;

export function ensureFxTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(FX_TEX.glow)) return;
  const g = scene.add.graphics();

  // 부드러운 발광 원 — 동심원을 낮은 알파로 겹쳐 가장자리 페이드
  const R = 16;
  for (let r = R; r > 0; r--) g.fillStyle(0xffffff, 0.05).fillCircle(R, R, r);
  g.generateTexture(FX_TEX.glow, R * 2, R * 2);
  g.clear();

  // 밝은 스파크
  g.fillStyle(0xffffff, 1).fillCircle(3, 3, 3);
  g.generateTexture(FX_TEX.spark, 6, 6);
  g.clear();

  // 파편 사각
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 5, 5);
  g.generateTexture(FX_TEX.debris, 5, 5);

  g.destroy();
}
