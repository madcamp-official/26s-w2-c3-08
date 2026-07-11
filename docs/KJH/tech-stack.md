# 기술 스택 (2026-07-10 확정)

## 스택 표
| 층 | 선택 | 근거 한 줄 |
|---|---|---|
| 프론트 | Vite + React + TypeScript | 일반 UI(로비·스튜디오·설정) 담당 |
| 게임 렌더/물리 | Phaser 3 (Arcade) + 커스텀 램프 로직 | 경사·슬라이딩·내려찍기 스파이크 검증 완료. 물리 계산부는 클라/서버 공유 순수 함수로 분리 예정 |
| 클라 상태관리 | Zustand | 가벼운 전역 상태 |
| 백엔드 | Node.js + Express + TypeScript | REST API (세션·에셋·방) |
| **실시간 인터랙션** | **WebSocket 기반 — Colyseus 프레임워크** | 서버 권위 상태 동기화·방 생명주기·중간 난입(join 시 상태 스냅샷)·재접속 내장. Colyseus 전송은 실용상 WebSocket뿐(WebTransport는 실험적+터널 미지원) — Cloudflare Tunnel 통과 가능해 우리 환경과 정합 |
| DB | PostgreSQL + Prisma (ORM) | attrs JSONB(카테고리별 가변 속성) 때문에 PG 권장. ※MySQL로 가려면 Prisma provider 한 줄 변경으로 전환 가능 (MySQL JSON 타입 사용) — 아래 참고 |
| 요청 검증 | Zod | attrs JSONB 형식 강제는 DB가 아니라 서버 Zod 스키마가 담당 |
| AI | 서버 전용 호출: LLM(프롬프트 생성) + ComfyUI GPU 서버(영상→스프라이트) | 키 비노출. 비동기 잡 큐, 첫 생성>재생성 우선순위, 재생성 쿨타임 5분 |
| 인프라 | KCLOUD VM + cloudflared Tunnel | 방화벽 22/80/443만 허용 → 외부 공개는 터널. WebSocket/Socket.IO/SSE 터널 통과 가능, 순수 TCP/UDP 불가 |

## 동기화 모델 (2026-07-10 전환 확정)
- **서버 권위(server-authoritative)**: 물리 상태의 원본은 Colyseus Room(서버 메모리). 클라이언트는 예측(prediction) + 서버 보정(reconciliation)
- 전환 이유: 중간 난입 지원(난입자에게 상태 스냅샷), 밟힘 판정의 공정한 서버 판정
- 물리 로직(경사 램프·슬라이딩·내려찍기)은 Phaser 의존 없는 순수 함수 모듈로 분리해 클라/서버 공유
- 좌표 등 순간 상태는 DB에 저장하지 않음 — 서버 메모리 + WebSocket 중계. 영구 데이터(계정·에셋·기록)만 DB

## Prisma와 DB의 관계 (팀원 참고)
- Prisma = ORM(도구), PostgreSQL/MySQL = DB. 양자택일 관계가 아님
- schema.prisma의 `datasource db { provider = "postgresql" }`를 `"mysql"`로 바꾸면 MySQL에서도 동작 (Json 필드는 MySQL JSON 컬럼으로 매핑됨)
- 권장은 PostgreSQL(JSONB 인덱싱·연산 우수). 이미 MySQL을 세팅했다면 provider 변경으로 진행해도 무방
- 스키마 파일: 같은 폴더의 `schema.prisma` (확정 3모델 활성 / 미확정 5모델 주석 — 주석 블록의 사유 참조)

## 규모 전제
- 동시 20~100명. DB는 이 규모에서 병목 아님(인덱스만 확보). 병목은 좌표 브로드캐스트 → Colyseus 델타+바이너리 패치가 담당

## 배포 환경 (2026-07-10 확정)

캠프 환경 분류 기준 **"KCLOUD VM + Tunnel"** 채택. 개발 중에는 VPN 내부 직접 접근 병행.

```
브라우저 (외부 누구나, VPN 불필요)
   │ https / wss (443)
   ▼
Cloudflare Tunnel
   ▼
KCLOUD VM ─── Express (REST: 세션·에셋·방 목록)
   │      └── Colyseus (WebSocket: 방·레이스 실시간)
   │      └── 프론트 정적 파일 서빙 (React 빌드 결과물)
   ├── PostgreSQL (VM 내부 전용 — 외부 노출 안 함, 터널 차단 대상 포트)
   └── (내부망 HTTP) → GPU VM (3090, ComfyUI) — 외부 비공개
```

- 사용 기술 전부 터널 통과 확인: HTTP/REST ✅, WebSocket(Colyseus) ✅
- 안 쓰는 것만 불가 목록에 해당: 순수 TCP/UDP, WebRTC 미디어, QUIC
- MVP는 VM 하나에서 프론트+백엔드 전부 서빙 (도메인 하나, CORS 없음). 프론트 별도 배포(Vercel 등)는 고도화 옵션
- 상세 인프라 절차(터널 등록, DNS API)는 팀 공유 예정인 인프라 노트 참조
