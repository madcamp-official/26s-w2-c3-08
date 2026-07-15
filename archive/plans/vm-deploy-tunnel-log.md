# VM 배포 + Cloudflare 터널 구축 기록 (2026-07-12)

baseworld 원격 테스트(대전 노트북 ↔ 대구 기숙사 5080)를 위해 KJH VM에 게임 서버·클라이언트를
배포하고 터널로 공개한 과정의 전체 기록. 배포 코드 기준: `kjh/baseworld-netphysics` 브랜치
커밋 `640ee96`.

---

## 1. 최종 결과 (접속 정보)

| 주소 | 역할 | 연결 대상 |
|---|---|---|
| https://sunboy7594.madcamp-kaist.org | 게임 클라이언트 (정적 빌드) | VM localhost:5173 |
| https://sunboy7594-game.madcamp-kaist.org | Colyseus 게임 서버 | VM localhost:2567 |

- **VPN 불필요** — 어느 네트워크에서든(대구 기숙사 포함) 브라우저로 바로 접속
- 사용법: 클라이언트 주소 접속 → `` ` `` 키 콘솔 → `join 닉네임` → 같은 방(baseworld)에서 만남
- 외부 검증 완료: 클라 200 OK / 매치메이킹 roomId 발급 정상 / WebSocket 업그레이드 101 성공

---

## 2. 사전에 확인된 네트워크 사실 (중요)

실측으로 확인한 KCLOUD 방화벽 동작:

| 접속 경로 | SSH(22) | 80/443 | 2567 등 기타 |
|---|---|---|---|
| 외부 공인 인터넷 → VM | **열림** | 방화벽 통과 (서비스 없으면 refused) | 타임아웃(차단) |
| KAIST 캠퍼스/기숙사망 → VM | **타임아웃(차단)** | (미확인, 차단 추정) | 차단 |
| VPN 경유 → VM | 열림 | 열림 | 열림 |

- 즉 "VM은 VPN으로만 접속 가능"은 **캠퍼스망에서만 참**. 외부 인터넷에서는 SSH 22가 그냥 열려 있음
- 이 때문에 터널 방식(Cloudflare 경유)이 캠퍼스망 차단을 우회하는 유일한 실용 해법
- 팀원 VM(172.10.7.82, camp-53)도 같은 정책 (외부에서 22 열림 확인). 참고: 팀원 SSH 비밀번호가
  "1" — 외부 인터넷에 노출된 상태라 변경 권고했으나 사용자가 나중에 바꾸기로 함

---

## 3. 수행 절차 (재현 가능한 순서)

### 3-1. VM 환경 (시작 시점)
- Ubuntu 22.04.2 LTS, x86_64, RAM 3.8GB, 디스크 97GB(사용 3%)
- git 2.34.1 있음 / node 없음 / cloudflared 없음

### 3-2. SSH 접속 방법 (자동화)
- 이 세션 환경(Windows Git Bash)에 sshpass/plink 없음 → **Python paramiko(5.0.0)** 로 해결
- 헬퍼 스크립트: scratchpad의 `vmrun.py` (호스트·계정은 `docs/KJH/secrets.local.md` 참조)
- 접속 정보 자체는 이 문서에 적지 않음 — secrets.local.md(gitignored)에만 둠

### 3-3. 설치
```bash
# Node.js 22 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
# → v22.23.1, npm 10.9.8

# cloudflared (.deb 직접 설치)
curl -sL -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i /tmp/cloudflared.deb
# → 2026.7.1

# 코드 (저장소는 public이라 인증 불필요)
cd /root && git clone -b kjh/baseworld-netphysics https://github.com/madcamp-official/26s-w2-c3-08.git game
cd game && npm install

# 프로세스 관리
npm install -g pm2 serve
```

### 3-4. 터널 등록 (DNS 셀프서비스 API)
API 키는 secrets.local.md의 DNS API Key. BASE=https://dns.madcamp-kaist.org

```bash
# ① 터널 생성 → installCommand 수신 (터널명 sunboy7594-tunnel)
curl -X POST -H "Authorization: Bearer $API_KEY" $BASE/v1/tunnels

# ② VM에서 systemd 서비스로 설치 (재부팅 자동 연결)
sudo cloudflared service install <installCommand의 토큰>
systemctl is-active cloudflared   # → active

# ③ 호스트네임 연결
#    클라이언트: 기본 서브도메인 @ → 5173
curl -X POST ... -d '{"subdomain": "sunboy7594", "localPort": 5173}' $BASE/v1/tunnels/hostnames
#    게임 서버: 추가 서브도메인(§4 참조) @ → 2567
curl -X POST ... -d '{"subdomain": "sunboy7594-game", "localPort": 2567}' $BASE/v1/tunnels/hostnames
```

### 3-5. 서버·클라 실행 (pm2 상시화)
```bash
cd /root/game
pm2 start npm --name game-server -- run -w server start        # tsx watch, 2567

cd /root/game/client
VITE_DEV_CONSOLE=1 VITE_SERVER_URL=wss://sunboy7594-game.madcamp-kaist.org npx vite build
pm2 start serve --name game-client -- -s dist -l 5173

pm2 save && pm2 startup systemd -u root --hp /root             # 재부팅 자동 시작
```

빌드 환경변수 2개가 핵심:
- `VITE_DEV_CONSOLE=1` — 프로덕션 빌드에서도 개발자 콘솔 포함 (기본은 트리셰이킹으로 제거됨)
- `VITE_SERVER_URL=wss://sunboy7594-game.madcamp-kaist.org` — 클라가 접속할 서버 주소를
  빌드에 박음 (기본값은 `location.hostname:2567`이라 터널 환경에서 오동작)

---

## 4. 트러블슈팅 — 겪은 문제와 해결

### 4-1. 2단계 서브도메인 TLS 실패 (가장 중요)
- 처음에 게임 서버를 `game.sunboy7594.madcamp-kaist.org`(기본 서브도메인 아래 name=game)로
  등록 → DNS는 전파됐지만 **HTTPS 핸드셰이크 실패** (curl: SEC_E_ILLEGAL_MESSAGE)
- 원인: Cloudflare 무료 플랜 Universal SSL 인증서는 `*.madcamp-kaist.org` **한 단계만** 커버.
  두 단계 깊이(`a.b.madcamp-kaist.org`)는 인증서가 없어 TLS가 깨짐
- **가이드 문서에는 다단계 이름(최대 3단계)이 가능하다고 되어 있으나 HTTPS로는 사실상 못 씀**
- 해결: 형제 레벨의 **추가 서브도메인** `sunboy7594-game`을 신청(`POST /v1/subdomains`)해서
  한 단계 깊이로 유지. 잘못 만든 호스트네임은 삭제
- 추가 서브도메인 한도 5개 중 1개 사용한 상태

### 4-2. 호스트네임 등록 일시 502
- `POST /v1/tunnels/hostnames`가 한 번 "error code: 502" 반환 → 몇 초 후 재시도로 성공.
  Cloudflare API 일시 오류로 보임. 재시도하면 됨

---

## 5. 운영 메모

- **코드 갱신 절차** (VM의 코드는 배포 시점 스냅샷):
  ```bash
  cd /root/game && git pull
  cd client && VITE_DEV_CONSOLE=1 VITE_SERVER_URL=wss://sunboy7594-game.madcamp-kaist.org npx vite build
  pm2 restart game-server
  # (클라는 정적 서빙이라 빌드만 다시 하면 됨, game-client 재시작 불필요)
  ```
- 서버는 개발 모드(tsx watch)로 실행 중 — 테스트·데모에는 충분, 정식 빌드 전환은 추후
- pm2 프로세스: `game-server`(2567), `game-client`(5173) — `pm2 list`, `pm2 logs`로 확인
- 터널 유지비: cloudflared는 systemd 서비스라 VM 재부팅에도 자동 복구. pm2도 startup 등록됨
- WebSocket이 터널을 통과하는 것은 Colyseus 선택 시점부터 의도된 설계
  (DNS 가이드 7-8: WebSocket ✅ / 순수 TCP·UDP ❌)
- 클라이언트를 dev 서버(vite dev)가 아니라 **빌드+정적 서빙**으로 올린 이유: 상시 구동 안정성,
  그리고 Vite dev 서버의 Host 헤더 검증 문제 회피
