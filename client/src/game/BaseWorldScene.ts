// baseworld 그레이박스 씬.
// - 자기 자신: shared/physics의 stepPlayer로 즉시 예측 + 서버 상태로 완만 보정
// - 다른 플레이어: 서버 상태를 LERP 보간
// - 연출(플립·스핀 회전, 웅크리기 압축)은 렌더 계층에서만 — 물리 좌표 불변
import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { getStateCallbacks } from "@colyseus/sdk";
import {
  stepPlayer, headStand, createPlayerPhys, TESTMAP, TUNING,
  type PlayerPhys, type PlayerInput,
} from "shared/physics";

const FIXED_MS = 1000 / TUNING.world.tickRate;

interface Avatar {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  rx: number; // 보간된 렌더 좌표 (물리 좌상단 기준)
  ry: number;
}

export class BaseWorldScene extends Phaser.Scene {
  private room: Room;
  private self: PlayerPhys = createPlayerPhys(TESTMAP.spawn.x, TESTMAP.spawn.y);
  private tick = 0;
  private accumulator = 0;
  private avatars = new Map<string, Avatar>();
  private keys!: Record<"left" | "right" | "jump" | "down" | "run", Phaser.Input.Keyboard.Key[]>;
  // 서버 뷰: 연출 없이 서버 원본 좌표·히트박스만 표시 (콘솔 serverview 명령)
  serverView = false;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private debugTexts = new Map<string, Phaser.GameObjects.Text>();

  constructor(room: Room) {
    super("baseworld");
    this.room = room;
  }

  create() {
    // 타일 격자 (1타일 = tileSize px)
    const tile = TUNING.world.tileSize;
    const grid = this.add.graphics().setDepth(-1);
    grid.lineStyle(1, 0xffffff, 0.07);
    for (let gx = 0; gx <= TESTMAP.width; gx += tile) {
      grid.lineBetween(gx, 0, gx, TESTMAP.height);
    }
    for (let gy = 0; gy <= TESTMAP.height; gy += tile) {
      grid.lineBetween(0, gy, TESTMAP.width, gy);
    }

    // 지형
    for (const s of TESTMAP.solids) {
      this.add.rectangle(s.x, s.y, s.w, s.h, 0x555566).setOrigin(0, 0);
    }
    const slopeGfx = this.add.graphics();
    slopeGfx.fillStyle(0x555566, 1);
    for (const s of TESTMAP.slopes) {
      if (s.dir === 1) {
        slopeGfx.fillTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x + s.w, s.y);
      } else {
        slopeGfx.fillTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x, s.y);
      }
    }

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
      jump: [kb.addKey(K.SPACE), kb.addKey(K.UP), kb.addKey(K.W)],
      down: [kb.addKey(K.DOWN), kb.addKey(K.S)],
      run: [kb.addKey(K.SHIFT)],
    };
    // 개발자 콘솔이 열려 있으면 게임이 키를 먹지 않도록 (mount 쪽에서 제어)
    kb.disableGlobalCapture();

    this.debugGfx = this.add.graphics().setDepth(10);

    const $ = getStateCallbacks(this.room);
    $(this.room.state).players.onAdd((player: any, id: string) => {
      const isSelf = id === this.room.sessionId;
      if (isSelf) { this.self.x = player.x; this.self.y = player.y; }
      const rect = this.add
        .rectangle(player.x, player.y, TUNING.world.playerW, TUNING.world.playerH,
          isSelf ? 0x4488ff : 0xff5555)
        .setOrigin(0.5, 0.5); // 회전 연출을 위해 중심 기준
      const label = this.add
        .text(player.x, player.y - 20, player.nickname || id.slice(0, 4), {
          fontSize: "14px", color: "#ffffff",
        })
        .setOrigin(0.5, 1);
      this.avatars.set(id, { rect, label, rx: player.x, ry: player.y });
    });
    $(this.room.state).players.onRemove((_player: any, id: string) => {
      const a = this.avatars.get(id);
      a?.rect.destroy();
      a?.label.destroy();
      this.avatars.delete(id);
    });
  }

  update(_time: number, delta: number) {
    this.accumulator += delta;
    while (this.accumulator >= FIXED_MS) {
      this.accumulator -= FIXED_MS;
      this.fixedTick();
    }
    this.render();
  }

  private fixedTick() {
    const held = (ks: Phaser.Input.Keyboard.Key[]) => ks.some((k) => k.isDown);
    const input: PlayerInput = {
      left: held(this.keys.left),
      right: held(this.keys.right),
      jump: held(this.keys.jump),
      down: held(this.keys.down),
      run: held(this.keys.run),
      tick: ++this.tick,
    };
    this.room.send("input", input);
    // 예측: 서버와 같은 함수·같은 지형으로 즉시 반영
    stepPlayer(this.self, input, FIXED_MS, TESTMAP);
    // 다른 플레이어 머리 위 지지도 예측 (상대의 서버 좌표만 필요)
    headStand(this.self, this.otherPositions());

    // 보정: 서버 권위 위치로 완만히 수렴 (밀림·밟힘은 이 경로로만 반영됨)
    const s: any = this.room.state.players.get(this.room.sessionId);
    if (s) {
      const dx = s.x - this.self.x;
      const dy = s.y - this.self.y;
      if (Math.hypot(dx, dy) > TUNING.net.selfSnapDistPx) {
        this.self.x = s.x; this.self.y = s.y;
        this.self.vx = s.vx; this.self.vy = s.vy;
      } else {
        this.self.x += dx * TUNING.net.selfCorrectLerp;
        this.self.y += dy * TUNING.net.selfCorrectLerp;
      }
    }
  }

  private otherPositions(): { x: number; y: number; crouch: boolean; slide: boolean }[] {
    const out: { x: number; y: number; crouch: boolean; slide: boolean }[] = [];
    (this.room.state as any).players.forEach((p: any, id: string) => {
      if (id !== this.room.sessionId) {
        out.push({ x: p.x, y: p.y, crouch: p.crouch, slide: p.slide });
      }
    });
    return out;
  }

  private render() {
    const W = TUNING.world.playerW;
    const H = TUNING.world.playerH;
    const tile = TUNING.world.tileSize;

    for (const [id, a] of this.avatars) {
      const isSelf = id === this.room.sessionId;
      const p: any = this.room.state.players.get(id);
      if (!p) continue;

      // 물리 좌표 (좌상단 기준)
      let x: number, y: number;
      let pound: number, hangLeftMs: number, spinLeftMs: number;
      let crouch: boolean, slide: boolean;
      let facing: number;
      if (isSelf) {
        x = this.self.x; y = this.self.y;
        pound = this.self.pound; hangLeftMs = this.self.poundHangLeftMs;
        spinLeftMs = this.self.spinLeftMs;
        crouch = this.self.crouch; slide = this.self.slide;
        facing = this.self.facing;
      } else {
        a.rx = Phaser.Math.Linear(a.rx, p.x, TUNING.net.othersLerp);
        a.ry = Phaser.Math.Linear(a.ry, p.y, TUNING.net.othersLerp);
        x = a.rx; y = a.ry;
        pound = p.pound; hangLeftMs = p.poundHangLeftMs;
        spinLeftMs = p.spinLeftMs;
        crouch = p.crouch; slide = p.slide;
        facing = p.facing;
      }

      // ── 연출 계층 (물리 좌표는 그대로) ──
      // 내려찍기 hang = 마리오식 앞구르기(평면 회전)
      let rot = 0;
      if (pound === 1) {
        const progress = 1 - hangLeftMs / TUNING.pound.hangMs;
        rot = progress * Math.PI * 2 * TUNING.pound.flipTurns * facing;
      }
      // 공중 스핀 = 세로축 회전 (몸이 좌우로 도는 느낌 — 가로 스케일 왕복)
      let yaw = 1;
      if (pound !== 1 && spinLeftMs > 0) {
        const progress = 1 - spinLeftMs / TUNING.spin.durationMs;
        yaw = Math.cos(progress * Math.PI * 2); // 1→-1→1: 한 바퀴 도는 인상
        if (Math.abs(yaw) < 0.05) yaw = yaw < 0 ? -0.05 : 0.05; // 완전 소실 방지
      }
      // 웅크리기·슬라이딩: 히트박스가 실제로 0.95타일 (렌더도 동일)
      const visH = crouch || slide ? TUNING.crouch.heightTiles * tile : H;

      a.rect.setDisplaySize(W, visH);
      a.rect.scaleX *= yaw;
      a.rect.setPosition(x + W / 2, y + H - visH / 2);
      a.rect.setRotation(rot);
      a.rect.fillColor = pound !== 0 ? 0xffcc33 : isSelf ? 0x4488ff : 0xff5555;
      a.label.setPosition(x + W / 2, y - 6);
    }
    this.renderServerView();
  }

  /** 서버 원본 좌표 오버레이. 진한 테두리 = 히트박스, 반투명 = 이미지(1×2타일) 크기 */
  private renderServerView() {
    this.debugGfx.clear();
    if (!this.serverView) {
      for (const t of this.debugTexts.values()) t.setVisible(false);
      return;
    }
    const W = TUNING.world.playerW;
    const H = TUNING.world.playerH;
    const tile = TUNING.world.tileSize;
    // 지형 히트박스
    this.debugGfx.lineStyle(1, 0x33ff77, 0.6);
    for (const s of TESTMAP.solids) this.debugGfx.strokeRect(s.x, s.y, s.w, s.h);
    for (const s of TESTMAP.slopes) {
      if (s.dir === 1) {
        this.debugGfx.strokeTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x + s.w, s.y);
      } else {
        this.debugGfx.strokeTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x, s.y);
      }
    }

    const seen = new Set<string>();
    (this.room.state as any).players.forEach((p: any, id: string) => {
      seen.add(id);
      // 이미지(스프라이트 캔버스 1×2타일) 크기 — 반투명, 히트박스 발밑·가로중앙 정렬
      this.debugGfx.fillStyle(0x33ff77, 0.15);
      this.debugGfx.fillRect(p.x + (W - tile) / 2, p.y + H - tile * 2, tile, tile * 2);
      // 실제 히트박스 — 진한 테두리 (웅크리기·슬라이딩이면 실제로 축소된 박스)
      const effH = p.crouch || p.slide ? TUNING.crouch.heightTiles * tile : H;
      this.debugGfx.lineStyle(2, 0x00e060, 1);
      this.debugGfx.strokeRect(p.x, p.y + H - effH, W, effH);

      let t = this.debugTexts.get(id);
      if (!t) {
        t = this.add.text(0, 0, "", { fontSize: "12px", color: "#33ff77" }).setDepth(11);
        this.debugTexts.set(id, t);
      }
      t.setVisible(true)
        .setPosition(p.x, p.y + H + 4)
        .setText(`(${Math.round(p.x)}, ${Math.round(p.y)}) v(${Math.round(p.vx)}, ${Math.round(p.vy)}) ${p.grounded ? "G" : "-"} p${p.pound}${p.crouch ? " C" : ""}${p.spinLeftMs > 0 ? " S" : ""}`);
    });
    for (const [id, t] of this.debugTexts) {
      if (!seen.has(id)) { t.destroy(); this.debugTexts.delete(id); }
    }
  }
}
