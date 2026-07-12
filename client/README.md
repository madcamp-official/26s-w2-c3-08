# Relay Map Maker Client

Vite + React + TypeScript + Phaser + Zustand 기반 프론트엔드 MVP입니다.

세부 구현 범위와 시연 체크리스트는 [FRONTEND_IMPLEMENTATION.md](FRONTEND_IMPLEMENTATION.md)에 정리했습니다.

## 실행

```bash
npm install
npm run dev --workspace client
npm run preview --workspace client
```

개발 서버:

- `http://localhost:5174/`
- `http://192.168.0.200:5174/`
- `https://mad-mario.madcamp-kaist.org/`

기본은 Mock 모드라 백엔드 없이도 로그인부터 결과 화면까지 시연할 수 있습니다.

## 검증

```bash
npm run lint --workspace client -- --quiet
npm run smoke --workspace client
npm run build --workspace client
```

## 주요 환경 변수

| 변수 | 설명 |
|---|---|
| `VITE_REMOTE_API=true` | 실제 `/api` REST 호출 사용 |
| `VITE_API_PROXY_TARGET=http://localhost:3000` | 개발 서버 API 프록시 대상 |
| `VITE_COLYSEUS_URL=wss://example.com` | Colyseus 서버 주소 |
| `VITE_LOCAL_REALTIME=false` | BroadcastChannel 로컬 실시간 폴백 비활성화 |
| `VITE_ALLOWED_HOSTS=host1,host2` | 추가 Vite 허용 호스트 |
