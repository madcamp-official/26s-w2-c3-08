// 가변 크기 손그림 상자 — 버튼·바·카드·패널의 공통 껍데기.
// 자식을 감싸면 실제 크기를 재서 그 크기에 맞는 꼬불꼬불 테두리+채움 SVG를 뒤에 깐다.
// 이 컴포넌트 하나로 모든 UI 부속품을 만들므로 "지글 규칙 깜빡" 문제가 구조적으로 사라진다.
import { forwardRef, useMemo } from "react";
import type { CSSProperties, ReactNode, PointerEventHandler, MouseEventHandler } from "react";
import { INK } from "../tokens/index.js";
import { buildRectPaths } from "./rough.js";
import type { SketchPreset } from "./rough.js";
import { useJiggle } from "./useJiggle.js";
import { useMeasure } from "./useMeasure.js";

export interface SketchBoxProps {
  children?: ReactNode;
  /** 채움색(면). 없으면 투명. */
  fill?: string;
  /** 테두리(잉크)색. null이면 테두리 없음. 기본 잉크. */
  stroke?: string | null;
  preset?: SketchPreset;
  /** 둥근 정도(px). 0=각짐(기본 상태 바·버튼), >0=둥근 손그림(팝업·칩). */
  radius?: number;
  /** 이 값이 true인 동안 테두리가 지글거림(호버/선택). */
  jiggle?: boolean;
  as?: "div" | "button";
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** 내부 콘텐츠 패딩(기본 없음 — 호출측이 style로도 가능). */
  pad?: number | string;
  /** 내부 콘텐츠를 flex 중앙정렬할지(버튼·바=true). 카드처럼 자유배치면 false. 기본 true. */
  center?: boolean;
  /** center=false일 때 내부 래퍼에 줄 스타일. */
  contentStyle?: CSSProperties;
  onClick?: MouseEventHandler<HTMLElement>;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  onPointerEnter?: PointerEventHandler<HTMLElement>;
  onPointerLeave?: PointerEventHandler<HTMLElement>;
  title?: string;
  ariaLabel?: string;
}

export const SketchBox = forwardRef<HTMLElement, SketchBoxProps>(function SketchBox(
  {
    children, fill, stroke = INK, preset = "frame", radius = 0, jiggle = false,
    as = "div", disabled, className, style, pad, center = true, contentStyle,
    onClick, onPointerDown, onPointerEnter, onPointerLeave, title, ariaLabel,
  },
  forwardedRef,
) {
  const [measureRef, size] = useMeasure<HTMLElement>();
  const seed = useJiggle(jiggle);

  const paths = useMemo(() => {
    if (size.w === 0 || size.h === 0) return [];
    return buildRectPaths({
      w: size.w, h: size.h, seed, preset, radius,
      stroke: stroke ?? undefined,
      fill, fillStyle: "solid",
    });
  }, [size.w, size.h, seed, preset, radius, stroke, fill]);

  const setRef = (el: HTMLElement | null) => {
    (measureRef as React.MutableRefObject<HTMLElement | null>).current = el;
    if (typeof forwardedRef === "function") forwardedRef(el);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = el;
  };

  const Tag = as;
  return (
    <Tag
      ref={setRef as never}
      className={className}
      disabled={as === "button" ? disabled : undefined}
      onClick={onClick as never}
      onPointerDown={onPointerDown as never}
      onPointerEnter={onPointerEnter as never}
      onPointerLeave={onPointerLeave as never}
      title={title}
      aria-label={ariaLabel}
      style={{
        position: "relative",
        border: "none",
        background: "transparent",
        padding: pad ?? 0,
        cursor: onClick && !disabled ? "pointer" : undefined,
        font: "inherit",
        color: "inherit",
        ...style,
      }}
    >
      <svg
        width={size.w} height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
      >
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.stroke === "none" ? undefined : p.stroke}
            strokeWidth={p.strokeWidth}
            fill={p.fill ?? "none"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <span
        style={
          center
            ? { position: "relative", display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", ...contentStyle }
            : { position: "relative", display: "block", width: "100%", height: "100%", ...contentStyle }
        }
      >
        {children}
      </span>
    </Tag>
  );
});
