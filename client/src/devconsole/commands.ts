// 개발자 콘솔 명령 (DEV 빌드 전용 — §32-3)
import { joinBaseworld, leaveBaseworld, getRoom } from "../rooms/baseworld/connect.js";
import { startGame, stopGame, getScene } from "../rooms/baseworld/boot.js";
import { TUNING, tuningDiff } from "shared/physics";
import { CATEGORIES, defaultAttrsByCategory, defaultMonsterAttrs, type MonsterAttrs } from "shared/schemas";
import { toggleMapEditor } from "../mapeditor/mount.js";
import { SOUNDS, EFFECTS, type SoundName, type EffectName } from "shared/effects";
import { playSound } from "../audio/sfx.js";
import { unlockAudio } from "../audio/zzfx.js";
import { playEffect } from "../fx/effects.js";
import { getAudioSettings, setSfxVolume, setMuted, toggleMuted } from "../audio/settings.js";

// 백엔드 HTTP 베이스 URL — Colyseus WS와 같은 호스트/포트(2567)에서 API가 돈다.
// connect.ts의 SERVER_URL(ws://...)을 http로 치환하거나 VITE_SERVER_URL을 직접 사용.
const HTTP_BASE: string = (() => {
  const explicit = import.meta.env.VITE_SERVER_HTTP_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, "");
  const ws = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (ws) return ws.replace(/^ws/, "http").replace(/\/$/, "");
  return `${location.protocol}//${location.hostname}:2567`;
})();

// 몬스터 옵션 축별 테스트 프리셋 (§spawnmonster). 기본형(defaultMonsterAttrs)에서 축 하나씩만 바꿔
// 각 옵션을 독립적으로 검증할 수 있게 함. note는 buildRuntimePart.ts의 TODO(builder) 미구현 표시.
interface MonsterPreset { desc: string; note?: string; attrs: () => MonsterAttrs }
const base = defaultMonsterAttrs;
const MONSTER_PRESETS: Record<string, MonsterPreset> = {
  walk: { desc: "기본 보행형(왕복) — 밟으면 즉사 (굼바)", attrs: () => base() },
  stationary: { desc: "고정형(제자리)", attrs: () => ({ ...base(), locomotion: { type: "stationary" } }) },
  fly: { desc: "비행형 — 이동 시 flap 사운드", attrs: () => ({ ...base(), locomotion: { type: "fly" } }) },
  climb: { desc: "등반형(벽·천장 기어감) — 이동 시 crawl 사운드", attrs: () => ({ ...base(), locomotion: { type: "climb" } }) },
  chase: { desc: "상시 추적 — 진입 시 aggro 사운드", attrs: () => ({ ...base(), pursuit: { type: "always" } }) },
  proximity: { desc: "근접 감지 추적 — 다가가면 aggro 사운드", attrs: () => ({ ...base(), pursuit: { type: "proximity", range: "near" } }) },
  sight: { desc: "시야형(부끄부끄식) — 보면 정지, 안 보면 이동", attrs: () => ({ ...base(), pursuit: { type: "sight" } }) },
  jumpsync: { desc: "점프 동기화 추적", note: "빌더 미구현 — 추적 동작 없음", attrs: () => ({ ...base(), pursuit: { type: "jump_sync" } }) },
  stun: { desc: "밟으면 기절 후 부활 — monsterStunned 사운드", attrs: () => ({ ...base(), stompReaction: { type: "stun", respawn: "short" } }) },
  spiky: { desc: "밟기 불가 — 밟으면 오히려 플레이어 피해", attrs: () => ({ ...base(), stompReaction: { type: "spiky" } }) },
  trampoline: { desc: "밟으면 크게 튕김", attrs: () => ({ ...base(), stompReaction: { type: "trampoline" } }) },
  shooter_straight: { desc: "직선 발사(주기) — shoot 사운드", attrs: () => ({ ...base(), shooter: { trigger: "periodic", period: "normal", arc: "straight", range: "normal" } }) },
  shooter_homing: { desc: "유도 발사(주기)", attrs: () => ({ ...base(), shooter: { trigger: "periodic", period: "normal", arc: "homing", range: "normal" } }) },
  shooter_proximity: { desc: "근접 감지 시 발사", attrs: () => ({ ...base(), shooter: { trigger: "proximity", period: "normal", arc: "straight", range: "near" } }) },
  hop: { desc: "주기적 도약 — hop 사운드", attrs: () => ({ ...base(), hop: { height: "high" } }) },
  enrage: { desc: "밟으면 분노(가속+추적 전환) — enrage 사운드", attrs: () => ({ ...base(), enrage: true }) },
  emerge: { desc: "잠복→등장(뻐끔플라워식, 주기)", attrs: () => ({ ...base(), emerge: { trigger: "periodic", period: "normal", range: "normal" } }) },
  teleport: { desc: "순간이동(주기) — teleport 사운드", attrs: () => ({ ...base(), teleport: { trigger: "periodic", period: "normal" } }) },
  flee: { desc: "보면 도망(다가가면 반대로 도주)", attrs: () => ({ ...base(), pursuit: { type: "flee", range: "near" } }) },
  shell: { desc: "밟으면 등껍질로 변함(엉금엉금) — shell 사운드", attrs: () => ({ ...base(), stompReaction: { type: "shell" } }) },
  explode: { desc: "밟으면 폭발(폭탄병)", note: "빌더 미구현 — 우선 즉사로 대체 처리", attrs: () => ({ ...base(), stompReaction: { type: "explode", radius: "normal" } }) },
  anchor: { desc: "돌진 후 원위치 복귀(사슬·와글와글)", note: "빌더 미구현 — 복귀 동작 없음", attrs: () => ({ ...base(), anchor: true }) },
  split: { desc: "사망 시 분열", note: "빌더 미구현 — 분열 동작 없음", attrs: () => ({ ...base(), splitOnDeath: true }) },
  shove: { desc: "접촉 시 넉백(피해 대신)", note: "빌더 미구현 — 넉백 동작 없음", attrs: () => ({ ...base(), shove: true }) },
  immortal: { desc: "무적 — 처치 불가(항상 spiky 고정)", attrs: () => ({ ...base(), immortal: true, hp: 1, stompReaction: { type: "spiky" } }) },
  hp2: { desc: "다중 타격(2회 필요)", attrs: () => ({ ...base(), hp: 2 }) },
  hp3: { desc: "다중 타격(3회 필요)", attrs: () => ({ ...base(), hp: 3 }) },
  boss: {
    desc: "복합형(보행+추적+발사+도약+분노) — 여러 사운드 동시 확인용",
    attrs: () => ({
      ...base(), pursuit: { type: "proximity", range: "far" },
      shooter: { trigger: "periodic", period: "normal", arc: "straight", range: "normal" },
      hop: { height: "low" }, enrage: true, hp: 3,
    }),
  },
};

export interface CmdCtx { print: (line: string) => void }
export interface Command {
  usage: string;
  desc: string;
  run: (args: string[], ctx: CmdCtx) => void | Promise<void>;
}

export const COMMANDS: Record<string, Command> = {
  help: {
    usage: "help",
    desc: "명령 목록 + serverview 옵션 설명",
    run: (_a, ctx) => {
      for (const c of Object.values(COMMANDS)) ctx.print(`${c.usage.padEnd(30)} ${c.desc}`);
      ctx.print("");
      ctx.print("serverview 옵션 (§19): 1=스프라이트 박스(보이는 모습, 반투명)");
      ctx.print("  2=히트박스(실제 판정, 진한 테두리·소속색)  3=서버 수신 상태(청록=나, 연두=남)");
      ctx.print("  주체: all|player|terrain|monster. 예) serverview player 1 2 / serverview off");
    },
  },
  join: {
    usage: "join [닉네임]",
    desc: "baseworld 접속 + 게임 시작",
    run: async (args, ctx) => {
      const room = await joinBaseworld(args[0]);
      startGame(room);
      ctx.print(`접속: ${room.roomId} (${room.sessionId})`);
      ctx.print("조작: ←→/AD 이동 · Space 점프 · ↓ 웅크리기/내려찍기 · Shift 달리기 · K 잡기");
    },
  },
  leave: {
    usage: "leave",
    desc: "나가기",
    run: async (_a, ctx) => { stopGame(); await leaveBaseworld(); ctx.print("나갔습니다."); },
  },
  players: {
    usage: "players",
    desc: "접속자 목록",
    run: (_a, ctx) => {
      const room = getRoom();
      if (!room) { ctx.print("접속 중 아님"); return; }
      let n = 0;
      room.state.players.forEach((p: { x: number; y: number; nickname: string }, id: string) => {
        ctx.print(`${id}${id === room.sessionId ? " (나)" : ""} ${p.nickname || "-"} (${Math.round(p.x)}, ${Math.round(p.y)})`);
        n++;
      });
      ctx.print(`총 ${n}명`);
    },
  },
  tp: {
    usage: "tp <x> <y>",
    desc: "순간이동",
    run: (args, ctx) => {
      const room = getRoom();
      const x = Number(args[0]), y = Number(args[1]);
      if (!room || !Number.isFinite(x) || !Number.isFinite(y)) { ctx.print("사용법: tp <x> <y>"); return; }
      room.send("tp", { x, y });
    },
  },
  tune: {
    usage: "tune <경로> <값>",
    desc: "수치 실시간 변경 (예: tune jump.velocity -900)",
    run: (args, ctx) => {
      const room = getRoom();
      const path = args[0], value = Number(args[1]);
      if (!room || !path || !Number.isFinite(value)) { ctx.print("사용법: tune <경로> <값>"); return; }
      room.send("tune", { path, value });
      ctx.print(`tune ${path} = ${value}`);
    },
  },
  tuning: {
    usage: "tuning",
    desc: "현재 수치 전체 출력",
    run: (_a, ctx) => { for (const l of JSON.stringify(TUNING, null, 1).split("\n")) ctx.print(l); },
  },
  tunediff: {
    usage: "tunediff",
    desc: "기본값 대비 변경된 수치만 출력 (tuning.json 반영용)",
    run: (_a, ctx) => {
      const d = tuningDiff();
      if (d.length === 0) { ctx.print("변경된 수치 없음"); return; }
      ctx.print(`변경 ${d.length}개 (기본 → 현재):`);
      for (const { path, from, to } of d) ctx.print(`  ${path.padEnd(28)} ${from} → ${to}`);
      ctx.print(`(tileSize=${TUNING.world.tileSize}${TUNING.world.tileSize === 64 ? " — tuning.json 값과 동일" : " — 64 아니라 환산됨"})`);
    },
  },
  serverview: {
    usage: "serverview [주체] [1|2|3...] | off",
    desc: "디버그 뷰어 (help 참고)",
    run: (args, ctx) => {
      const sc = getScene();
      if (!sc) { ctx.print("게임 미실행 — join 먼저"); return; }
      if (args[0] === "off" || args.length === 0) { sc.svOpts.clear(); ctx.print("serverview off"); return; }
      const subjects = ["all", "player", "terrain", "monster"] as const;
      let i = 0;
      if ((subjects as readonly string[]).includes(args[0])) { sc.svSubject = args[0] as typeof sc.svSubject; i = 1; }
      else sc.svSubject = "all";
      sc.svOpts.clear();
      for (; i < args.length; i++) {
        const n = Number(args[i]);
        if (n >= 1 && n <= 3) sc.svOpts.add(n);
      }
      ctx.print(`serverview ${sc.svSubject} [${[...sc.svOpts].join(",")}]`);
    },
  },
  macro: {
    usage: "macro record|stop|play reset|play loop|status",
    desc: "키 입력 녹화·반복 (혼자 2인 테스트용 §11)",
    run: (args, ctx) => {
      const sc = getScene();
      if (!sc) { ctx.print("게임 미실행 — join 먼저"); return; }
      const sub = args[0];
      if (sub === "record") {
        sc.macroBuf = []; sc.macroIdx = 0;
        sc.macroStart = { x: sc.me.body.x, y: sc.me.body.y };
        sc.macroState = "recording";
        ctx.print("녹화 시작 — macro stop으로 종료");
      } else if (sub === "stop") {
        if (sc.macroState === "recording") ctx.print(`녹화 종료 (${sc.macroBuf.length}틱 저장)`);
        else ctx.print("재생 중단");
        sc.macroState = "idle";
      } else if (sub === "play") {
        if (sc.macroBuf.length === 0) { ctx.print("저장된 매크로 없음 — macro record 먼저"); return; }
        sc.macroMode = args[1] === "reset" ? "reset" : "loop";
        sc.macroIdx = 0;
        sc.macroState = "playing";
        ctx.print(`재생 시작 (${sc.macroMode}) — macro stop으로 중단`);
      } else {
        ctx.print(`상태: ${sc.macroState}` + (sc.macroState === "recording" ? ` (${sc.macroBuf.length}틱)` :
          sc.macroState === "playing" ? ` (${sc.macroMode}, ${sc.macroIdx}/${sc.macroBuf.length})` :
          ` (버퍼 ${sc.macroBuf.length}틱)`));
      }
    },
  },
  genasset: {
    usage: "genasset <카테고리> <이름> <이미지URL> [attrsJSON]",
    desc: "에셋 제출 → 생성 큐 적재 (파이프라인 진입점). attrs 생략 시 카테고리 기본값",
    run: async (args, ctx) => {
      const [category, name, sourceImageUrl, ...rest] = args;
      if (!category || !name || !sourceImageUrl) {
        ctx.print("사용법: genasset <카테고리> <이름> <이미지URL> [attrsJSON]");
        ctx.print(`카테고리: ${CATEGORIES.join(" | ")}`);
        return;
      }
      if (!(CATEGORIES as readonly string[]).includes(category)) {
        ctx.print(`알 수 없는 카테고리: ${category} (${CATEGORIES.join(" | ")})`);
        return;
      }
      // defaultAttrsByCategory[cat]는 팩토리 함수 — 호출해서 초기 attrs 객체를 얻는다. item은 기본 없음(시스템 시드).
      const factory = defaultAttrsByCategory[category as keyof typeof defaultAttrsByCategory];
      if (!factory) { ctx.print(`${category}는 유저 제작 대상이 아닙니다 (attrs 직접 지정 필요)`); return; }
      let attrs: unknown = factory();
      if (rest.length > 0) {
        try { attrs = JSON.parse(rest.join(" ")); }
        catch { ctx.print("attrsJSON 파싱 실패 — 유효한 JSON이어야 함"); return; }
      }
      ctx.print(`제출 중… (${category} "${name}")`);
      try {
        const res = await fetch(`${HTTP_BASE}/api/asset/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, name, sourceImageUrl, attrs }),
        });
        const body = await res.json();
        if (!res.ok) {
          ctx.print(`실패 (${res.status}): ${body.error ?? "unknown"}`);
          if (body.issues) for (const iss of body.issues) ctx.print(`  · ${iss.path?.join(".")}: ${iss.message}`);
          return;
        }
        ctx.print(`에셋 생성됨: id=${body.id} status=${body.status}`);
        ctx.print(`생성 큐(${body.sprites?.length ?? 0}개 액션):`);
        for (const s of body.sprites ?? []) ctx.print(`  · ${s.action.padEnd(8)} [${s.status}] prio=${s.priority}`);
      } catch (e) {
        ctx.print(`네트워크 오류: ${e instanceof Error ? e.message : String(e)} (HTTP_BASE=${HTTP_BASE})`);
      }
    },
  },
  spawnmonster: {
    usage: "spawnmonster <프리셋|list> [x] [y]",
    desc: "몬스터 옵션별 테스트 스폰 (join 후 사용). 프리셋 목록: spawnmonster list",
    run: (args, ctx) => {
      const room = getRoom();
      const sc = getScene();
      if (!room || !sc) { ctx.print("게임 미실행 — join 먼저"); return; }
      const [name, xs, ys] = args;
      if (!name || name === "list") {
        ctx.print(`몬스터 프리셋 ${Object.keys(MONSTER_PRESETS).length}개 (옵션 축별 1개씩 — 전부 개별 테스트 가능):`);
        for (const [key, p] of Object.entries(MONSTER_PRESETS)) {
          ctx.print(`  spawnmonster ${key.padEnd(16)} ${p.desc}${p.note ? `  ⚠️ ${p.note}` : ""}`);
        }
        ctx.print("좌표 생략 시 내 앞(오른쪽 150px, 위 100px)에 스폰. 예) spawnmonster fly 800 400");
        return;
      }
      const preset = MONSTER_PRESETS[name];
      if (!preset) { ctx.print(`알 수 없는 프리셋: ${name} (spawnmonster list)`); return; }
      const b = sc.me.body;
      const x = xs !== undefined ? Number(xs) : b.x + 150;
      const y = ys !== undefined ? Number(ys) : b.y - 100;
      if (!Number.isFinite(x) || !Number.isFinite(y)) { ctx.print("사용법: spawnmonster <프리셋> [x] [y]"); return; }
      room.send("spawnMonster", { attrs: preset.attrs(), x, y });
      ctx.print(`스폰 요청: ${name} @ (${Math.round(x)}, ${Math.round(y)})${preset.note ? `  ⚠️ ${preset.note}` : ""}`);
    },
  },
  mapedit: {
    usage: "mapedit",
    desc: "맵 에디터 열기/닫기 토글 (UI 셸 검증 전용 — 더미 에셋, 저장 없음)",
    run: (_a, ctx) => {
      const opened = toggleMapEditor();
      ctx.print(opened ? "맵 에디터 열림" : "맵 에디터 닫는 중…");
    },
  },
  playsound: {
    usage: "playsound <이름|list>",
    desc: "사운드 단독 재생(오디션용, 게임 미실행 상태에서도 가능)",
    run: (args, ctx) => {
      unlockAudio(); // 콘솔 입력 자체가 사용자 제스처라 여기서 해제
      const name = args[0];
      if (!name || name === "list") {
        ctx.print(`사운드 ${SOUNDS.length}개: ${SOUNDS.join(", ")}`);
        return;
      }
      if (!(SOUNDS as readonly string[]).includes(name)) {
        ctx.print(`알 수 없는 사운드: ${name} (playsound list)`);
        return;
      }
      playSound(name as SoundName);
      ctx.print(`재생: ${name}`);
    },
  },
  playeffect: {
    usage: "playeffect <이름|list> [x] [y]",
    desc: "이펙트 단독 재생(오디션용). join 후 사용 — 좌표 생략 시 내 위치",
    run: (args, ctx) => {
      const sc = getScene();
      if (!sc) { ctx.print("게임 미실행 — join 먼저 (이펙트는 씬이 필요함)"); return; }
      const name = args[0];
      if (!name || name === "list") {
        ctx.print(`이펙트 ${EFFECTS.length}개: ${EFFECTS.join(", ")}`);
        return;
      }
      if (!(EFFECTS as readonly string[]).includes(name)) {
        ctx.print(`알 수 없는 이펙트: ${name} (playeffect list)`);
        return;
      }
      const b = sc.me.body;
      const x = args[1] !== undefined ? Number(args[1]) : b.x;
      const y = args[2] !== undefined ? Number(args[2]) : b.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) { ctx.print("사용법: playeffect <이름> [x] [y]"); return; }
      playEffect(sc, name as EffectName, x, y);
      ctx.print(`재생: ${name} @ (${Math.round(x)}, ${Math.round(y)})`);
    },
  },
  volume: {
    usage: "volume [0-100]",
    desc: "효과음 볼륨 조회/설정 (설정 화면 연결 전 임시 — localStorage 저장됨)",
    run: (args, ctx) => {
      if (args.length === 0) {
        const s = getAudioSettings();
        ctx.print(`볼륨 ${Math.round(s.sfxVolume * 100)}% · ${s.muted ? "뮤트 중" : "뮤트 아님"}`);
        return;
      }
      const pct = Number(args[0]);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) { ctx.print("사용법: volume <0~100>"); return; }
      setSfxVolume(pct / 100);
      ctx.print(`볼륨 → ${pct}%`);
    },
  },
  mute: {
    usage: "mute [on|off]",
    desc: "효과음 뮤트 토글/설정",
    run: (args, ctx) => {
      if (args[0] === "on") { setMuted(true); ctx.print("뮤트 on"); return; }
      if (args[0] === "off") { setMuted(false); ctx.print("뮤트 off"); return; }
      ctx.print(`뮤트 ${toggleMuted() ? "on" : "off"}`);
    },
  },
  clear: { usage: "clear", desc: "출력 지우기", run: () => {} },
};

export async function execute(raw: string, ctx: CmdCtx): Promise<"clear" | void> {
  const [name, ...args] = raw.trim().split(/\s+/);
  if (!name) return;
  if (name === "clear") return "clear";
  const cmd = COMMANDS[name];
  if (!cmd) { ctx.print(`알 수 없는 명령: ${name} (help)`); return; }
  try { await cmd.run(args, ctx); }
  catch (e) { ctx.print(`오류: ${e instanceof Error ? e.message : String(e)}`); }
}
