// 맵 에디터를 앱과 독립된 루트에 마운트/토글. 닫기는 UI 버튼이 아니라 콘솔 mapedit 재입력.
// 닫힘 연출(방향별 스프링 퇴장)이 끝날 때까지 기다린 뒤 실제 언마운트.
import { createRoot, type Root } from "react-dom/client";
import { MapEditor } from "./MapEditor.js";
import { useEditorStore } from "./editorStore.js";
import { CLOSE_SETTLE_MS } from "./motionTokens.js";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

export function isMapEditorOpen(): boolean {
  return container !== null;
}

/** 열려있으면 닫기 연출 후 언마운트, 닫혀있으면 마운트. 반환값 = 이번 호출로 "열렸는지" 여부 */
export function toggleMapEditor(): boolean {
  if (container) {
    useEditorStore.setState({ closing: true });
    const target = container;
    const targetRoot = root;
    container = null;
    root = null;
    setTimeout(() => {
      targetRoot?.unmount();
      target.remove();
    }, CLOSE_SETTLE_MS);
    return false;
  }

  useEditorStore.setState({ closing: false });
  container = document.createElement("div");
  container.id = "mapeditor-root";
  document.body.appendChild(container);
  root = createRoot(container);
  root.render(<MapEditor />);
  return true;
}
