// 기본 에셋 76개(소스 그림 + 메타데이터)를 배포 서버 DB에 HTTP로 밀어넣는다. SSH 불필요.
// 스프라이트 시트는 여기서 안 만든다 — submit이 AssetSprite를 status=queued로 큐잉만 하고(background는
// deriveActions=[]라 0개), 실제 시트는 나중에 워커가 채운다("사진 먼저, 스프라이트 나중").
//
// 흐름(에셋당):
//   1) GET  /api/assets/by-name/{name}  → 200이면 이미 있음 → 스킵(재실행 안전; isSystem+name 매칭)
//   2) POST /api/asset/upload-source     (multipart image) → { normUrl } (투명 PNG 그대로 호스팅)
//   3) POST /api/asset/submit            { category, name, attrs, sourceImageUrl, sourceType:"drawn", isSystem:true }
//
// ⚠️ 삭제 엔드포인트가 없어 HTTP로는 기존 데이터 제거 불가 — 이 스크립트는 "추가/스킵"만 한다.
//    기존 시드(굼바 등 한글명 placeholder)를 지우려면 VM에서 DB로 직접 해야 함(별개 작업).
//
// 사용:
//   node gpu-worker/scripts/push-assets.mjs --dry-run     (쓰기 없이 현재 상태·충돌만 확인)
//   node gpu-worker/scripts/push-assets.mjs               (실제 푸시)
//   SERVER_URL 은 gpu-worker/.env 에서 자동 로드(없으면 --server=<url>)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS } from "../../asset-sources/manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
try { process.loadEnvFile(path.join(ROOT, "gpu-worker", ".env")); } catch {}

const DRY = process.argv.includes("--dry-run");
const serverArg = process.argv.find((a) => a.startsWith("--server="));
const SERVER = (serverArg ? serverArg.split("=")[1] : process.env.SERVER_URL)?.replace(/\/$/, "");
if (!SERVER) { console.error("SERVER_URL 미설정 — .env 또는 --server=<url>"); process.exit(1); }

console.log(`[push] 서버: ${SERVER}  모드: ${DRY ? "DRY-RUN(쓰기 없음)" : "실제 푸시"}`);
console.log(`[push] 대상: ${ASSETS.length}개\n`);

async function exists(name) {
  const res = await fetch(`${SERVER}/api/assets/by-name/${encodeURIComponent(name)}`);
  return res.status === 200;
}

async function uploadSource(pngBuf, filename) {
  const form = new FormData();
  form.set("image", new Blob([new Uint8Array(pngBuf)], { type: "image/png" }), filename);
  const res = await fetch(`${SERVER}/api/asset/upload-source`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`upload-source HTTP ${res.status}: ${await res.text()}`);
  return res.json(); // { rawUrl, normUrl, needsAiNorm, ... }
}

async function submit(asset, sourceImageUrl) {
  const res = await fetch(`${SERVER}/api/asset/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      category: asset.category,
      name: asset.name,
      attrs: asset.attrs,
      sourceImageUrl,
      sourceType: "drawn",
      isSystem: true,
    }),
  });
  if (!res.ok) throw new Error(`submit HTTP ${res.status}: ${await res.text()}`);
  return res.json(); // 생성된 asset (jsonSafe)
}

async function main() {
  const results = [];
  let created = 0, skipped = 0, failed = 0;

  for (const asset of ASSETS) {
    try {
      if (await exists(asset.name)) {
        console.log(`  · 스킵(이미 있음): ${asset.name} (${asset.category})`);
        skipped++;
        results.push({ id: asset.id, name: asset.name, status: "skipped" });
        continue;
      }
      if (DRY) {
        console.log(`  + [DRY] 생성 예정: ${asset.name} (${asset.category}) ← ${asset.file}`);
        created++;
        results.push({ id: asset.id, name: asset.name, status: "would-create" });
        continue;
      }
      const png = readFileSync(path.join(ROOT, "asset-sources", asset.file));
      const up = await uploadSource(png, path.basename(asset.file));
      const url = up.normUrl ?? up.rawUrl;
      const row = await submit(asset, url);
      console.log(`  + 생성: ${asset.name} (${asset.category}) → assetId=${row.id} sourceUrl=${url}`);
      created++;
      results.push({ id: asset.id, name: asset.name, status: "created", assetId: row.id, sourceUrl: url });
    } catch (e) {
      console.error(`  ✗ 실패: ${asset.name} — ${e.message}`);
      failed++;
      results.push({ id: asset.id, name: asset.name, status: "failed", error: e.message });
    }
  }

  const outPath = path.join(ROOT, `push-assets-result${DRY ? "-dryrun" : ""}.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n[push] ${DRY ? "예정" : "생성"} ${created} / 스킵 ${skipped} / 실패 ${failed} — 기록: ${outPath}`);
}

main().catch((e) => { console.error("[push] 치명적:", e); process.exit(1); });
