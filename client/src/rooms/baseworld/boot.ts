// Phaser 게임 생성/파괴 + 콘솔 접근 지점
import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { TESTMAP } from "shared/maps";
import { BaseworldScene } from "./BaseworldScene.js";

let game: Phaser.Game | null = null;
let container: HTMLDivElement | null = null;
let scene: BaseworldScene | null = null;

export function startGame(room: Room): void {
  if (game) stopGame();
  container = document.createElement("div");
  container.id = "baseworld-container";
  container.style.cssText = "position:fixed;inset:0;z-index:1000;background:#1a1a24;";
  document.body.appendChild(container);
  scene = new BaseworldScene(room);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: Math.min(1280, TESTMAP.width),
    height: Math.min(800, TESTMAP.height),
    backgroundColor: "#1a1a24",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });
}

export function stopGame(): void {
  game?.destroy(true);
  game = null; scene = null;
  container?.remove(); container = null;
}

export function getScene(): BaseworldScene | null { return scene; }
