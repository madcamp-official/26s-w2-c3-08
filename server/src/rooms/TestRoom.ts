// baseworld — 규칙 없는 물리 샌드박스 방 (docs/KJH/dev-console.md).
// 서버 권위: 클라는 입력만 보내고, 물리는 여기(고정틱)서만 진실이 된다.
// 물리 로직은 shared/physics — 클라 예측과 완전히 같은 함수.

import { Room, Client, CloseCode } from "colyseus";
import {
  stepPlayer, resolvePush, resolveStomps, resolveHeadStand,
  createPlayerPhys, applyTuning, TESTMAP, TUNING,
  type PlayerInput, type PlayerPhys,
} from "shared/physics";
import { TestState, PlayerState } from "./schema/TestState.js";

const FIXED_MS = 1000 / TUNING.world.tickRate;

export class TestRoom extends Room {
  maxClients = 16;
  state = new TestState();

  // sessionId → 물리 상태(원본) / 입력 큐
  private phys = new Map<string, PlayerPhys>();
  private inputs = new Map<string, PlayerInput[]>();
  private lastTick = new Map<string, number>();
  private tuneOverrides = new Map<string, number>(); // 늦게 접속한 클라에게 재전송용

  messages = {
    input: (client: Client, input: PlayerInput) => {
      this.inputs.get(client.sessionId)?.push(input);
    },
    // 개발용 순간이동 (개발자 콘솔 tp 명령)
    tp: (client: Client, msg: { x: number; y: number }) => {
      const p = this.phys.get(client.sessionId);
      if (!p) return;
      p.x = msg.x; p.y = msg.y; p.vx = 0; p.vy = 0;
    },
    // 개발용 런타임 튜닝: 적용되면 전 클라에 같은 값을 전파해 예측과 동기화
    tune: (client: Client, msg: { path: string; value: number }) => {
      if (typeof msg?.path !== "string" || typeof msg?.value !== "number") return;
      if (applyTuning(msg.path, msg.value)) {
        this.tuneOverrides.set(msg.path, msg.value);
        this.broadcast("tune", { path: msg.path, value: msg.value });
        console.log(`[baseworld] tune ${msg.path} = ${msg.value} (by ${client.sessionId})`);
      }
    },
  };

  onCreate(_options: any) {
    let elapsed = 0;
    this.setSimulationInterval((dt) => {
      elapsed += dt;
      while (elapsed >= FIXED_MS) {
        elapsed -= FIXED_MS;
        this.fixedTick();
      }
    });
  }

  private fixedTick() {
    // 1) 각자 입력 큐 소진하며 물리 (shared — 클라 예측과 동일 함수)
    for (const [id, p] of this.phys) {
      const queue = this.inputs.get(id)!;
      let input: PlayerInput | undefined;
      while ((input = queue.shift())) {
        stepPlayer(p, input, FIXED_MS, TESTMAP);
        this.lastTick.set(id, input.tick);
      }
    }
    // 2) 플레이어 간 상호작용 (서버 전용 — 밀기·밟기)
    const ids = [...this.phys.keys()];
    const list = ids.map((id) => this.phys.get(id)!);
    resolvePush(list);
    resolveStomps(list);
    resolveHeadStand(list);
    // 3) 동기화 상태에 반영
    for (const id of ids) {
      const p = this.phys.get(id)!;
      const s = this.state.players.get(id)!;
      s.x = p.x; s.y = p.y; s.vx = p.vx; s.vy = p.vy;
      s.grounded = p.grounded; s.facing = p.facing; s.pound = p.pound;
      s.poundHangLeftMs = p.poundHangLeftMs;
      s.crouch = p.crouch; s.slide = p.slide; s.spinLeftMs = p.spinLeftMs;
      s.tick = this.lastTick.get(id) ?? 0;
    }
  }

  onJoin(client: Client, options: any) {
    const p = createPlayerPhys(
      TESTMAP.spawn.x + Math.random() * 200,
      TESTMAP.spawn.y,
    );
    this.phys.set(client.sessionId, p);
    this.inputs.set(client.sessionId, []);

    const s = new PlayerState();
    s.x = p.x; s.y = p.y;
    s.nickname = typeof options?.nickname === "string" ? options.nickname.slice(0, 12) : "";
    this.state.players.set(client.sessionId, s);
    // 이 방에서 바뀐 튜닝 값을 새 클라에도 적용
    for (const [path, value] of this.tuneOverrides) {
      client.send("tune", { path, value });
    }
    console.log(`[baseworld] join ${client.sessionId} (${this.phys.size}명)`);
  }

  onLeave(client: Client, _code: CloseCode) {
    this.phys.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.lastTick.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    console.log(`[baseworld] leave ${client.sessionId} (${this.phys.size}명)`);
  }
}
