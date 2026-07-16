// Phaser 게임 생성/파괴 + 콘솔 접근 지점
import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { TESTMAP } from "shared/maps";
import { BaseworldScene } from "./BaseworldScene.js";
import type { SceneWorld } from "./sceneWorld.js";

let game: Phaser.Game | null = null;
let container: HTMLDivElement | null = null;
let scene: BaseworldScene | null = null;

/** parent 지정 시 그 요소 안에 꽉 채워 마운트(맵 에디터 테스트 모드) — 없으면 기존처럼 풀스크린.
 *  world 지정 시 그 월드로(테스트=단일 라인, 레이스=병합맵) — 없으면 TESTMAP(콘솔 경로). */
export function startGame(room: Room, parent?: HTMLElement, world?: SceneWorld): void {
  if (game) stopGame();
  const embedded = !!parent;
  const w = world ?? TESTMAP;
  if (embedded) {
    container = document.createElement("div");
    container.style.cssText = "position:absolute;inset:0;background:#1a1a24;";
    parent.appendChild(container);
  } else {
    container = document.createElement("div");
    container.id = "baseworld-container";
    container.style.cssText = "position:fixed;inset:0;z-index:1000;background:#1a1a24;";
    document.body.appendChild(container);
  }
  scene = new BaseworldScene(room, w);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: embedded ? parent!.clientWidth : Math.min(1280, w.width),
    height: embedded ? parent!.clientHeight : Math.min(800, w.height),
    backgroundColor: "#1a1a24",
    scale: { mode: embedded ? Phaser.Scale.RESIZE : Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });
}

export function stopGame(): void {
  game?.destroy(true);
  game = null; scene = null;
  container?.remove(); container = null;
}

export function getScene(): BaseworldScene | null { return scene; }
