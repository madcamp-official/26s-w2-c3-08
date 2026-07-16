// 시스템 기본 에셋 + 테스트 라인 시드. 멱등: (isSystem, name) / MapLine.name으로 존재 확인 후 생성.
// 실행: npm run -w server seed  (VM에서 — DATABASE_URL은 server/.env)
//
// 스프라이트 시트는 여기서 만들지 않는다(임시방편 — 렌더가 색 사각형인 동안 불필요).
// P4에서 파이프라인 재생성으로 채운다. sourceImageUrl은 NOT NULL이라 단색 PNG를 실제 생성해 둔다.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  parseAttrs, deriveColumnMirror, defaultBlockAttrs, defaultMonsterAttrs,
  type Category, type AssetAttrs,
} from "shared/schemas";
import { TESTLINES, QUICKLINES } from "shared/maps";
import { prisma } from "../prisma.js";
import { saveSourcePng } from "../asset/storage.js";

// Prisma Client는 .env를 자동 로드하지 않음 — 단독 실행용 최소 로더
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

interface SeedAsset {
  key: string;              // "sys.*" — 픽스처 assetKey와 일치
  name: string;             // DB 표시명 + 멱등 판별키
  category: Category;
  attrs: AssetAttrs;
  hitboxHPx?: number;
  color: { r: number; g: number; b: number };   // 소스 PNG 단색
}

function block(over: Partial<ReturnType<typeof defaultBlockAttrs>>) {
  return { ...defaultBlockAttrs(), ...over };
}
function monster(over: Partial<ReturnType<typeof defaultMonsterAttrs>>) {
  return { ...defaultMonsterAttrs(), ...over };
}

const SEED_ASSETS: SeedAsset[] = [
  { key: "sys.stickman", name: "졸라맨", category: "avatar", attrs: { v: 1 }, hitboxHPx: 115, color: { r: 220, g: 220, b: 220 } },
  { key: "sys.mushroom", name: "거대버섯", category: "item", attrs: { v: 1, effect: "giant_mushroom" }, color: { r: 230, g: 80, b: 60 } },
  { key: "sys.boost", name: "가속", category: "item", attrs: { v: 1, effect: "speed_boost" }, color: { r: 250, g: 200, b: 40 } },
  { key: "sys.ground", name: "기본 땅", category: "block", attrs: block({}), color: { r: 139, g: 90, b: 43 } },
  {
    key: "sys.platform", name: "반통과 발판", category: "block",
    attrs: block({ size: { w: 3, h: 1 }, collision: { type: "top_only" } }), color: { r: 74, g: 157, b: 224 },
  },
  {
    key: "sys.spike", name: "가시", category: "block",
    attrs: block({ collision: { type: "none" }, contactEffect: { type: "damage", zone: "except_top" } }),
    color: { r: 229, g: 37, b: 33 },
  },
  { key: "sys.spring", name: "트램펄린", category: "block", attrs: block({ bouncy: { power: "high" } }), color: { r: 67, g: 160, b: 71 } },
  { key: "sys.switch", name: "스위치", category: "block", attrs: block({ togglesSwitch: true }), color: { r: 246, g: 190, b: 0 } },
  {
    key: "sys.gate", name: "스위치 발판", category: "block",
    attrs: block({ size: { w: 2, h: 1 }, presence: { type: "switch_on" } }), color: { r: 180, g: 140, b: 255 },
  },
  {
    key: "sys.qblock", name: "물음표 블록", category: "block",
    attrs: block({ itemGiver: "giant" }), color: { r: 246, g: 190, b: 0 },
  },
  { key: "sys.goomba", name: "굼바", category: "monster", attrs: monster({}), color: { r: 160, g: 100, b: 60 } },
  {
    key: "sys.spiky", name: "가시돌이", category: "monster",
    attrs: monster({ locomotion: { type: "stationary" }, stompReaction: { type: "spiky" } }),
    color: { r: 120, g: 40, b: 120 },
  },
];

async function seedAssets(): Promise<Map<string, bigint>> {
  const ids = new Map<string, bigint>();
  for (const s of SEED_ASSETS) {
    const existing = await prisma.asset.findFirst({ where: { isSystem: true, name: s.name }, select: { id: true } });
    if (existing) {
      ids.set(s.key, existing.id);
      continue;
    }
    const attrs = parseAttrs(s.category, s.attrs);
    const mirror = deriveColumnMirror(s.category, attrs);
    const png = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { ...s.color, alpha: 1 } },
    }).png().toBuffer();
    const sourceImageUrl = await saveSourcePng(`system_${s.key.replace(".", "_")}`, png);
    const created = await prisma.asset.create({
      data: {
        isSystem: true, category: s.category, name: s.name,
        attrs: attrs as object,
        colliderType: mirror.colliderType, slopeDir: mirror.slopeDir,
        widthCells: mirror.widthCells, heightCells: mirror.heightCells,
        hitboxHPx: s.hitboxHPx ?? null,
        sourceImageUrl, status: "ready",
      },
    });
    ids.set(s.key, created.id);
    console.log(`[seed] asset ${s.key} → id=${created.id}`);
  }
  return ids;
}

async function seedLines(assetIds: Map<string, bigint>): Promise<void> {
  for (const line of [...TESTLINES, ...QUICKLINES]) {
    const existing = await prisma.mapLine.findFirst({ where: { name: line.name }, select: { id: true } });
    if (existing) continue;
    const created = await prisma.mapLine.create({
      data: {
        name: line.name,
        tileLength: line.tileLength,
        startFlagX: line.startFlag.x, startFlagY: line.startFlag.y,
        endFlagX: line.endFlag.x, endFlagY: line.endFlag.y,
        testPassedAt: new Date(),   // 픽스처 = 항상 사용 가능
        placements: {
          create: line.placements.map((p) => {
            const assetId = assetIds.get(p.assetKey);
            if (!assetId) throw new Error(`픽스처 assetKey 미시드: ${p.assetKey}`);
            return { assetId, x: p.x, y: p.y, flipX: p.flipX ?? false, endX: p.endX ?? null, endY: p.endY ?? null };
          }),
        },
      },
    });
    console.log(`[seed] line ${line.name} → id=${created.id} (${line.placements.length} placements)`);
  }
}

const assetIds = await seedAssets();
await seedLines(assetIds);
console.log("[seed] 완료");
await prisma.$disconnect();
