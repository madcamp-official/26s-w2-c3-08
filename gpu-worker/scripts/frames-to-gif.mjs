// raw-*.png 프레임들을 애니메이션 GIF 1개로 합친다 — 실험 결과를 눈으로 편하게 돌려보기 위함.
// 사용: node gpu-worker/scripts/frames-to-gif.mjs <프레임폴더> [출력gif경로] [fps]
import sharp from "sharp";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , inDir, outPathArg, fpsArg] = process.argv;
if (!inDir) {
  console.error("사용: node frames-to-gif.mjs <프레임폴더> [출력.gif] [fps]");
  process.exit(1);
}
const outPath = outPathArg ?? path.join(inDir, "anim.gif");
const fps = Number(fpsArg ?? 8);

const files = readdirSync(inDir)
  .filter((f) => /^raw-\d+\.png$/.test(f))
  .sort();
if (files.length === 0) {
  console.error("raw-*.png 없음:", inDir);
  process.exit(1);
}

const frames = [];
let width = 0;
let height = 0;
for (const f of files) {
  const { data, info } = await sharp(path.join(inDir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  width = info.width;
  height = info.height;
  frames.push(data);
}

const joined = Buffer.concat(frames);
const gif = await sharp(joined, {
  raw: { width, height: height * frames.length, channels: 4 },
  animated: true,
  pageHeight: height,
})
  .gif({ delay: Math.round(1000 / fps), loop: 0 })
  .toBuffer();

writeFileSync(outPath, gif);
console.log(`생성됨: ${outPath} (${frames.length}프레임, ${width}x${height}, ${fps}fps, ${gif.length}bytes)`);
