// baseworld Phaser 게임의 생성/파괴. 개발자 콘솔 join/leave 명령이 호출한다.
import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { TESTMAP } from "shared/physics";
import { BaseWorldScene } from "./BaseWorldScene.js";

let game: Phaser.Game | null = null;
let container: HTMLDivElement | null = null;
let scene: BaseWorldScene | null = null;

export function startGame(room: Room): void {
  if (game) stopGame();
  container = document.createElement("div");
  container.id = "baseworld-container";
  container.style.cssText =
    "position:fixed;inset:0;z-index:1000;background:#1a1a24;";
  document.body.appendChild(container);

  scene = new BaseWorldScene(room);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: TESTMAP.width,
    height: TESTMAP.height,
    backgroundColor: "#1a1a24",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });
}

export function stopGame(): void {
  game?.destroy(true);
  game = null;
  scene = null;
  container?.remove();
  container = null;
}

export function isGameRunning(): boolean {
  return game !== null;
}

/** 서버 뷰 토글. 반환값 = 적용된 상태 (게임 미실행이면 null) */
export function setServerView(on?: boolean): boolean | null {
  if (!scene) return null;
  scene.serverView = on ?? !scene.serverView;
  return scene.serverView;
}
