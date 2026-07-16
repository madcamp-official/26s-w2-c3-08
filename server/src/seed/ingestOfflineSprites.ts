// gpu-worker-sprites/<assetId>/<action>.png (오프라인 생성 결과, 71/71 커밋됨) 전체를
// DB AssetSprite(ready)로 벌크 반영. VM에서 실행해야 함(saveSheetPng가 로컬 STORAGE_DIR에 씀).
// 실행: npm run -w server ingest-offline
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../prisma.js";
import { saveSheetPng } from "../asset/storage.js";
// mjs 매니페스트(루트 asset-sources) — id(디렉토리명)→name(DB 에셋명)·tiles 매핑의 원천
import { ASSETS } from "../../../asset-sources/manifest.mjs";

// Prisma는 .env 자동 로드 안 함(systemAssets.ts와 동일한 최소 로더)
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

// 오프라인 생성기(gpu-worker/src/dev/generateOffline.ts)는 액션당 항상 8프레임 가로 스트립으로 뽑는다
// (_gen.log 전수 확인: 모든 idle/walk/onair가 "8f"). 프레임 크기는 에셋 비율에 따라 다르므로
// frameW = 시트폭/8, frameH = 시트높이. (이전 버그: frameW를 tiles.w×64로 고정 계산해 한 프레임을 3등분해 잘랐음.)
const FRAMES = 8;

interface ManifestAsset { id: string; name: string; category: string; tiles: { w: number; h: number } }

async function main(): Promise<void> {
  const root = path.resolve(process.cwd(), "..");   // server/ 기준 레포 루트
  const spritesRoot = path.join(root, "gpu-worker-sprites");
  if (!existsSync(spritesRoot)) throw new Error(`디렉토리 없음: ${spritesRoot}`);

  let assets = 0, sheets = 0, skipped = 0;
  for (const m of ASSETS as ManifestAsset[]) {
    const dir = path.join(spritesRoot, m.id);
    if (!existsSync(dir)) { skipped++; continue; }

    const row = await prisma.asset.findFirst({ where: { isSystem: true, name: m.name }, select: { id: true } });
    if (!row) { console.warn(`[ingest] DB 에셋 없음, 건너뜀: ${m.id} (name="${m.name}")`); skipped++; continue; }

    const pngs = readdirSync(dir).filter((f) => f.endsWith(".png"));
    if (pngs.length === 0) { skipped++; continue; }
    assets++;

    for (const file of pngs) {
      const action = path.basename(file, ".png");
      const buf = readFileSync(path.join(dir, file));
      const meta = await sharp(buf).metadata();
      const width = meta.width ?? 0, height = meta.height ?? 0;
      if (!width || !height) { console.warn(`[ingest] 크기 판독 실패: ${m.id}/${file}`); continue; }
      // 항상 8프레임 가로 스트립 — frameW는 폭/8, frameH는 시트 높이.
      const frameCount = FRAMES;
      const frameW = Math.round(width / FRAMES);
      const frameH = height;

      const existing = await prisma.assetSprite.findFirst({ where: { assetId: row.id, action }, select: { id: true } });
      const spriteId = existing
        ? existing.id
        : (await prisma.assetSprite.create({ data: { assetId: row.id, action, status: "queued" }, select: { id: true } })).id;
      const sheetUrl = await saveSheetPng(spriteId, buf);
      await prisma.assetSprite.update({
        where: { id: spriteId },
        data: { sheetUrl, frameCount, frameW, frameH, status: "ready" },
      });
      sheets++;
    }
    console.log(`[ingest] ${m.id} → asset#${row.id} (${pngs.length}액션)`);
  }
  console.log(`\n완료: 에셋 ${assets}개 · 시트 ${sheets}장 반영, ${skipped}개 건너뜀`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exitCode = 1; });
