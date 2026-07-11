// GPU 워커 — 기숙사 데스크톱(5080) / 3090 VM 공용 상주 프로그램.
// 서버가 GPU 머신으로 먼저 접속할 수 없으므로(NAT/내부망) 당기기(pull) 모델:
//
//   루프:
//   1) GET  {SERVER_URL}/api/ai/jobs/next   (워커 토큰 인증) — 일감 폴링
//   2) 일감 수신: 원본 그림 + 액션별 프롬프트 + 배경 키 색상
//   3) 로컬 ComfyUI 실행 → 후처리(크로마키 제거·bbox 정규화·8프레임·시트 패킹)
//   4) POST {SERVER_URL}/api/ai/jobs/{id}/result — 스프라이트 시트 업로드
//
// 상세 설계: docs/KJH/architecture.md, docs/KJH/ai-pipeline.md
//
// TODO: 구현. 환경변수 — SERVER_URL, WORKER_TOKEN, COMFYUI_URL

console.log('gpu-worker: 미구현 스텁입니다. docs/KJH/architecture.md 참조.');
