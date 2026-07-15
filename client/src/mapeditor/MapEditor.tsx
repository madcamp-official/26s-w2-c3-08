// 맵 에디터 UI 셸 — 손그림 노랑 테마(2026-07-16 재도장, 나머지 화면과 동일 팔레트/모션 언어).
// 레이아웃: 좌측 창고가 화면 좌측 전체 세로를 차지. 즐겨찾기·캔버스·툴바·하단바는 그 오른쪽 영역 안에서만 존재
// (좌측 패널을 접으면 오른쪽 영역이 그만큼 넓어짐 — 이 폭 변화도 스프링).
// 각 패널은 자기 붙어있는 화면 가장자리에서 스프링으로 등장, 닫을 때는 같은 방향으로 역재생 후 실제 언마운트.
// 닫기는 UI 버튼이 아니라 콘솔 mapedit 재입력(mount.tsx가 closing을 store에 세팅).
import { WarehousePanel } from "./components/WarehousePanel.js";
import { FavoritesPanel } from "./components/FavoritesPanel.js";
import { Toolbar } from "./components/Toolbar.js";
import { BottomBar } from "./components/BottomBar.js";
import { MapCanvas } from "./components/MapCanvas.js";
import { useEditorStore } from "./editorStore.js";
import { YELLOW, INK } from "../design/tokens/index.js";

export function MapEditor() {
  const closing = useEditorStore((s) => s.closing);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: YELLOW.list,
        color: INK,
        display: "flex",
        fontFamily: "var(--font-body)",
        overflow: "hidden",
      }}
    >
      <WarehousePanel index={0} closing={closing} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <FavoritesPanel index={1} closing={closing} />

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <MapCanvas index={2} closing={closing} />
          <Toolbar index={3} closing={closing} />
        </div>

        <BottomBar index={4} closing={closing} />
      </div>
    </div>
  );
}
