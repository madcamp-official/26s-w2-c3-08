// 창고·즐겨찾기 공용 카드 — 정사각형, 카테고리 대표색(옅은 반투명) 배경.
// 모서리: 평소엔 카테고리 아이콘, 그 근처로 마우스를 가져가면 액션 버튼(+/✕)으로 전환.
// 카드 전체 호버 시 즉시 상세 툴팁. 소유자는 "내가 만든" 것만 하단에 작게 표시.
// 나중에 실제 에셋 이미지가 들어오면 이 대표색이 이미지 뒤 배경으로 남는 구조(2026-07-15).
import { forwardRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import type { PlaceholderCard } from "../testData.js";
import { CATEGORY_COLOR, CATEGORY_ICON, GROUP_LABEL } from "../testData.js";
import { BORDER_W, RADIUS } from "../sizeTokens.js";

export interface CategoryCardProps extends HTMLAttributes<HTMLDivElement> {
  card: PlaceholderCard;
  size: number;
  selected?: boolean;
  actionIcon: string; // "+"(창고→즐겨찾기 추가) | "✕"(즐겨찾기→제거)
  actionTitle: string;
  onAction: () => void;
  actionDisabled?: boolean;
}

export const CategoryCard = forwardRef<HTMLDivElement, CategoryCardProps>(function CategoryCard(
  { card, size, selected, actionIcon, actionTitle, onAction, actionDisabled, style, ...rest },
  ref,
) {
  const [hovered, setHovered] = useState(false);
  const [nearCorner, setNearCorner] = useState(false);
  const color = CATEGORY_COLOR[card.group];

  return (
    <div
      ref={ref}
      {...rest}
      onMouseEnter={(e) => {
        setHovered(true);
        rest.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        setNearCorner(false);
        rest.onMouseLeave?.(e);
      }}
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        border: selected ? `${BORDER_W + 1}px solid #fff` : `${BORDER_W}px solid #fff`,
        borderRadius: RADIUS,
        background: hexToRgba(color, 0.28),
        cursor: "grab",
        userSelect: "none",
        ...style,
      }}
    >
      {/* 모서리 반응 영역 — 카드 전체가 아니라 이 근처에서만 아이콘↔액션 전환 */}
      <div
        onMouseEnter={() => setNearCorner(true)}
        onMouseLeave={() => setNearCorner(false)}
        style={{ position: "absolute", top: -10, right: -10, width: 34, height: 34 }}
      >
        {nearCorner ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (!actionDisabled) onAction();
            }}
            disabled={actionDisabled}
            title={actionTitle}
            style={{ ...cornerBtnStyle, opacity: actionDisabled ? 0.4 : 1, cursor: actionDisabled ? "default" : "pointer" }}
          >
            {actionIcon}
          </button>
        ) : (
          <div style={cornerIconStyle} title={GROUP_LABEL[card.group]}>
            {CATEGORY_ICON[card.group]}
          </div>
        )}
      </div>

      {card.mine && <div style={ownerStripStyle}>나의 에셋</div>}

      {hovered && (
        <div style={tooltipStyle}>
          {card.label} · {GROUP_LABEL[card.group]} · {card.mine ? "내가 만든" : "공용"}
        </div>
      )}
    </div>
  );
});

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const cornerIconStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  color: "#fff",
  opacity: 0.85,
  pointerEvents: "none",
};

const cornerBtnStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background: "#000",
  color: "#fff",
  border: `${BORDER_W}px solid #fff`,
  fontSize: 14,
  padding: 0,
};

const ownerStripStyle: CSSProperties = {
  position: "absolute",
  left: 4,
  right: 4,
  bottom: 4,
  fontSize: 9,
  textAlign: "center",
  background: "rgba(0,0,0,0.5)",
  borderRadius: 4,
  padding: "2px 0",
  pointerEvents: "none",
};

const tooltipStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  marginTop: 6,
  background: "#000",
  border: `${BORDER_W}px solid #fff`,
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 11,
  whiteSpace: "nowrap",
  zIndex: 20,
  pointerEvents: "none",
};
