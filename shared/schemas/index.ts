// attrs(에셋 속성) Zod 검증 스키마 — 클라 폼 검증과 서버 저장 검증이
// 같은 정의를 사용한다. 형식의 원본 명세: docs/KJH/asset-attributes.md
//
// TODO: 카테고리별 스키마 (avatar / platform / obstacle / monster / background)
//  - [택1] 그룹 = z.enum, 독립 옵션 = boolean, 수치 = 3단 프리셋 enum
//  - 조건부 필드(slope 선택 시 방향 등) = z.discriminatedUnion 또는 refine

export {};
