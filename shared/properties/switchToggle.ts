// 라인 스위치 토글 마커 — 실제 발동은 접촉(onTouch)이 아니라 아래에서 치거나 내려찍었을 때만
// (BaseworldScene의 bonkHead/poundOn 처리, 2026-07-15 통일). 접촉 매 틱 재토글 버그 해소.
// onTouch를 안 두는 이유: 이 프로퍼티는 여전히 spec.properties에 마커로 남아 시각 언어 파생
// (deriveVisualTagsFromSpec의 switchToggler 오라)에 쓰이지만, 실제 동작은 여기서 안 함.
import { registerProperty } from "./registry.js";
registerProperty("switchToggle", {});
