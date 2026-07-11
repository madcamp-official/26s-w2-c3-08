// baseworld 동기화 상태. 서버가 권위로 갱신하고 전 클라에 델타 전송된다.
import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("boolean") grounded: boolean = false;
  @type("int8") facing: number = 1;
  @type("uint8") pound: number = 0;   // 0=none 1=hang 2=fall
  @type("number") poundHangLeftMs: number = 0; // 타 클라의 플립 연출 진행도용
  @type("boolean") crouch: boolean = false;
  @type("boolean") slide: boolean = false;
  @type("number") spinLeftMs: number = 0;
  @type("number") tick: number = 0;   // 마지막 반영된 입력 틱 (보정용)
  @type("string") nickname: string = "";
}

export class TestState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
