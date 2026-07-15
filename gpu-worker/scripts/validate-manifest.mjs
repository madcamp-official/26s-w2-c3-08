// asset-sources/manifest.mjs의 모든 attrs를 실제 zod 스키마(parseAttrs)로 검증.
// 실행: npx tsx gpu-worker/scripts/validate-manifest.mjs (또는 node --experimental-strip-types 등)
import { parseAttrs } from "../../shared/schemas/index.js";
import { ASSETS } from "../../asset-sources/manifest.mjs";

let fail = 0;
for (const a of ASSETS) {
  try {
    parseAttrs(a.category, a.attrs);
  } catch (e) {
    fail++;
    console.error(`❌ ${a.id} (${a.category}):`, e.errors ?? e.message);
  }
}
console.log(fail === 0 ? `✅ 전부 통과 (${ASSETS.length}개)` : `❌ ${fail}/${ASSETS.length}개 실패`);
process.exit(fail === 0 ? 0 : 1);
