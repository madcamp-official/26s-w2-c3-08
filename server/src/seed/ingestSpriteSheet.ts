// 로컬 PNG 스프라이트 시트를 기존 에셋(주로 시스템 기본 에셋, 예: sys.stickman)에 직접 부착.
// GPU 워커 생성 파이프라인을 거치지 않고 손으로 만든/받은 시트를 바로 ready 상태로 꽂아 넣는
// 용도(§2026-07-16, 마리오 시트 도착 시 사용) — AssetSprite.action 계약은 그대로 지킨다.
//
// 실행: npm run -w server ingest-sprites -- "<에셋이름>" <소스디렉터리>
//   소스디렉터리/manifest.json: { [action]: { file, frameCount, frameW, frameH } }
//   소스디렉터리/<file>: 가로 스트립 PNG (투명 배경), 프레임이 frameCount개 가로로 나열
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { saveSheetPng } from "../asset/storage.js";
import { ACTION, type ActionName } from "shared/actions";

// Prisma Client는 .env를 자동 로드하지 않음 — systemAssets.ts와 동일한 최소 로더
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

interface ActionEntry { file: string; frameCount: number; frameW: number; frameH: number }

async function main(): Promise<void> {
  const [assetName, sourceDirArg] = process.argv.slice(2);
  if (!assetName || !sourceDirArg) {
    console.error("사용법: ingest-sprites -- \"<에셋이름>\" <소스디렉터리>");
    process.exitCode = 1;
    return;
  }
  const sourceDir = path.resolve(sourceDirArg);
  const manifestPath = path.join(sourceDir, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`manifest.json 없음: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, ActionEntry>;

  const asset = await prisma.asset.findFirst({ where: { isSystem: true, name: assetName }, select: { id: true } });
  if (!asset) throw new Error(`에셋을 못 찾음: "${assetName}" (systemAssets 시드가 먼저 실행됐는지 확인)`);

  const validActions = new Set<string>(Object.values(ACTION));
  for (const [action, entry] of Object.entries(manifest)) {
    if (!validActions.has(action)) {
      console.warn(`[ingest] "${action}"은 shared/actions 카탈로그에 없는 액션 — 스킵`);
      continue;
    }
    const filePath = path.join(sourceDir, entry.file);
    if (!existsSync(filePath)) { console.warn(`[ingest] 파일 없음, 스킵: ${filePath}`); continue; }
    const png = readFileSync(filePath);
    const sheetUrl = await saveSheetPng(`${asset.id}_${action}`, png);
    await prisma.assetSprite.upsert({
      where: { assetId_action: { assetId: asset.id, action } },
      create: {
        assetId: asset.id, action: action as ActionName,
        sheetUrl, frameCount: entry.frameCount, frameW: entry.frameW, frameH: entry.frameH,
        status: "ready",
      },
      update: { sheetUrl, frameCount: entry.frameCount, frameW: entry.frameW, frameH: entry.frameH, status: "ready", errorMsg: null },
    });
    console.log(`[ingest] ${assetName} · ${action} → ${sheetUrl} (${entry.frameCount}프레임 ${entry.frameW}x${entry.frameH})`);
  }

  const remaining = await prisma.assetSprite.count({ where: { assetId: asset.id, status: { not: "ready" } } });
  if (remaining === 0) {
    await prisma.asset.update({ where: { id: asset.id }, data: { status: "ready" } });
    console.log(`[ingest] 에셋 "${assetName}" 전체 액션 준비 완료 → status=ready`);
  }
}

await main();
await prisma.$disconnect();
