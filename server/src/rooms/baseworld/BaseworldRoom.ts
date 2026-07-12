// baseworld: 규칙 없는 물리 샌드박스 (§7). PhysicsRoom 상속, 지형·파츠만 지정.
import { PhysicsRoom, type WorldDef } from "../base/PhysicsRoom.js";
import { TESTMAP } from "shared/maps";

export class BaseworldRoom extends PhysicsRoom {
  maxClients = 16;

  protected worldDef(): WorldDef {
    return {
      terrain: TESTMAP.terrain,
      blocks: TESTMAP.blocks,
      monsters: TESTMAP.monsters,
      items: TESTMAP.items,
      line: TESTMAP.line,
      spawn: TESTMAP.spawn,
    };
  }
}
