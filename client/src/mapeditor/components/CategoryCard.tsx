// 창고·즐겨찾기 공용 카드 — 손그림 SketchBox(chip 프리셋), 카테고리 대표색(옅은 반투명) 채움.
// 액션 버튼(+/✕)은 모서리가 아니라 카드 "중앙"에 뜬다(2026-07-16 확정 변경).
// 선택된 카드(즐겨찾기 붓 장전)는 선택 지속 중 계속 지글(useJiggle) — 호버가 아니라 selected로 판단.
// 호버 시 카드 아래에 상세정보 팝업(이름/카테고리/크기/소유구분/공용라벨), 팝업 테두리는 항상 지글.
import { forwardRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import type { PlaceholderCard } from "../testData.js";
import { GROUP_LABEL } from "../testData.js";
import { SketchBox } from "../../design/sketch/index.js";
import { YELLOW, INK, WORLD } from "../../design/tokens/index.js";
import { HTTP_BASE } from "../../net/rest.js";

/** 카테고리 → 팔레트 WORLD 색(2026-07-16, testData의 임의색 대신 공식 팔레트 재사용) */
const GROUP_COLOR: Record<PlaceholderCard["group"], string> = {
  block: WORLD.device,
  monster: WORLD.enemy,
  item: WORLD.item,
  background: WORLD.terrain,
};

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
  const color = GROUP_COLOR[card.group];

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
        rest.onMouseLeave?.(e);
      }}
      style={{ position: "relative", width: size, height: size, flexShrink: 0, userSelect: "none", ...style }}
    >
      <SketchBox
        fill={hexToRgba(color, 0.24)}
        stroke={INK}
        preset="chip"
        radius={10}
        jiggle={!!selected}
        center={false}
        contentStyle={{ position: "relative", width: "100%", height: "100%" }}
        style={{ width: "100%", height: "100%", cursor: "grab" }}
      >
        {/* 실제 원본 그림 있으면 썸네일로 — 선택(장전) 중엔 회색조(2026-07-16 확정) */}
        {card.sourceImageUrl && (
          <img
            src={`${HTTP_BASE}${card.sourceImageUrl}`}
            alt=""
            draggable={false}
            style={{
              position: "absolute", inset: 8, width: "calc(100% - 16px)", height: "calc(100% - 16px)",
              objectFit: "contain", pointerEvents: "none",
              filter: selected ? "grayscale(1)" : "none",
            }}
          />
        )}

        <div style={cornerIconStyle} title={GROUP_LABEL[card.group]}>
          {GROUP_LABEL[card.group][0]}
        </div>

        {card.mine && <div style={ownerStripStyle}>나의 에셋</div>}

        {/* 액션 버튼 — 카드 중앙(호버 시에만 노출) */}
        {hovered && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (!actionDisabled) onAction();
            }}
            disabled={actionDisabled}
            title={actionTitle}
            style={{ ...cornerBtnStyle, opacity: actionDisabled ? 0.45 : 1, cursor: actionDisabled ? "default" : "pointer" }}
          >
            {actionIcon}
          </button>
        )}
      </SketchBox>

      {hovered && (
        <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 8, zIndex: 20 }}>
          <SketchBox fill={YELLOW.card} stroke={INK} preset="chip" radius={8} jiggle
            contentStyle={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 11, color: INK }}>
              {card.label} · {GROUP_LABEL[card.group]} · {card.w}×{card.h} · {card.mine ? "내가 만든" : "공용"}
            </span>
          </SketchBox>
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
  position: "absolute",
  top: 4,
  right: 6,
  fontSize: 11,
  fontWeight: 700,
  color: INK,
  opacity: 0.7,
  pointerEvents: "none",
};

const cornerBtnStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: YELLOW.base,
  color: INK,
  border: `2px solid ${INK}`,
  fontSize: 14,
  fontWeight: 700,
  padding: 0,
};

const ownerStripStyle: CSSProperties = {
  position: "absolute",
  left: 4,
  right: 4,
  bottom: 4,
  fontSize: 9,
  textAlign: "center",
  color: INK,
  opacity: 0.75,
  pointerEvents: "none",
};
