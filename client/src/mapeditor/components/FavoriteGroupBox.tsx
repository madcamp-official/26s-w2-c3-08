// 즐겨찾기 그룹(카테고리) 박스 — 같은 그룹 내 드래그 재정렬.
// framer-motion Reorder(1축 전용)는 여러 줄로 감싸지면 위치 계산이 깨져서, 2D 그리드를 정식 지원하는
// dnd-kit(@dnd-kit/core + sortable, rectSortingStrategy)로 교체(2026-07-15).
// 접힘(1줄) 상태에서는 실제 컨테이너 폭으로 "윗줄에 보이는 개수"를 측정해 그만큼만 렌더링·재정렬 대상으로 삼는다
// (아랫줄은 렌더 자체를 안 해서 드래그 판정에서 완전히 제외됨).
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import type { CardGroup, PlaceholderCard } from "../testData.js";
import { useEditorStore } from "../editorStore.js";
import { FAV_CARD_SIZE, GAP } from "../sizeTokens.js";
import { CategoryCard } from "./CategoryCard.js";

export function FavoriteGroupBox({
  group,
  cards,
  collapsed,
}: {
  group: CardGroup;
  cards: PlaceholderCard[];
  collapsed: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(cards.length || 1);
  const reorderGroup = useEditorStore((s) => s.reorderGroup);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setPerRow(Math.max(1, Math.floor((w + GAP) / (FAV_CARD_SIZE + GAP))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 접힘 중엔 실제로 윗줄에 보이는 개수만 취급 — 나머지(아랫줄, 가려짐)는 렌더 자체를 안 함
  const visible = collapsed ? cards.slice(0, perRow) : cards;
  const hidden = collapsed ? cards.slice(perRow) : [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = visible.findIndex((c) => c.id === active.id);
    const newIndex = visible.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderGroup(group, [...arrayMove(visible, oldIndex, newIndex), ...hidden]);
  }

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visible.map((c) => c.id)} strategy={rectSortingStrategy}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: GAP }}>
            {visible.map((card) => (
              <FavoriteCard key={card.id} card={card} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function FavoriteCard({ card }: { card: PlaceholderCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const removeFavorite = useEditorStore((s) => s.removeFavorite);
  const selectedFavoriteId = useEditorStore((s) => s.selectedFavoriteId);
  const selectFavorite = useEditorStore((s) => s.selectFavorite);

  return (
    <CategoryCard
      ref={setNodeRef}
      card={card}
      size={FAV_CARD_SIZE}
      selected={selectedFavoriteId === card.id}
      actionIcon="✕"
      actionTitle="즐겨찾기에서 제거"
      onAction={() => removeFavorite(card.id)}
      onClick={() => selectFavorite(card.id)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      {...attributes}
      {...listeners}
    />
  );
}
