# 인프라 노트 — DNS 셀프서비스 API & KCLOUD

> 출처: 캠프 제공 가이드(DNS 셀프서비스 API + KCLOUD 개괄), 2026-07 수신

---

## 우리 프로젝트 관점 핵심 요약

> **우리 스택(Node + Socket.IO) 공개 가능 여부: 가능**
>
> - **Socket.IO / WebSocket은 이 터널로 외부 공개 가능합니다.** WebSocket(ws/wss)과 Socket.IO는 HTTP Upgrade 기반이라 Cloudflare Tunnel의 HTTP ingress를 그대로 통과합니다. (원문 7-8 근거)
> - **KCLOUD 방화벽은 22 / 80 / 443 포트만 허용합니다.** 따라서 3000 / 8080 등 개발 포트로는 외부에서 직접 접속할 수 없습니다. 외부 공개 방법은 두 가지입니다.
>   - (a) VM 안에서 `cloudflared` 터널을 실행 → 외부 요청을 VM localhost:포트로 전달
>   - (b) nginx / Caddy / Apache 등 reverse proxy로 80 / 443을 경유
> - **GPU VM은 RTX 3090 20G 사양이며, 주간 선착순 신청입니다.** (분반당 6개)
> - **DB 포트(5432 등)는 터널로 노출할 수 없으며 차단 대상입니다.** DB는 VM 내부에서만 접근하십시오. (차단 포트: 22, 3306, 5432, 6379, 27017, 9200 등)

---

## 1. 개괄 및 네트워크 제약

이 API를 사용하면 Cloudflare에 직접 접속하지 않고도 여러분의 서브도메인 아래에 DNS 레코드를 자유롭게 만들고, 수정하고, 삭제할 수 있습니다. 또한 추가 서브도메인을 직접 신청/반납할 수 있으며, VM에서 돌아가는 로컬 서버를 터널(Tunnel) 기능으로 외부에 공개할 수 있습니다.

### 기본 개념

- 관리자가 기본 서브도메인 하나를 할당합니다(예: `alice.madcamp-kaist.org`). 추가 서브도메인(`myproject.madcamp-kaist.org`)은 직접 신청 가능합니다.
- DNS 레코드의 `name`은 서브도메인 기준 상대 경로입니다.
  - 기본 `alice`에서 `name=www` → `www.alice.madcamp-kaist.org`
  - 기본 `alice`에서 `name=api` → `api.alice.madcamp-kaist.org`
  - 추가 `myproject`에서 `name=www` → `www.myproject.madcamp-kaist.org`
- 이름 최대 깊이: `a.b.c` 3단계까지.
- API 기본 URL: `https://dns.madcamp-kaist.org`
- 환경변수 설정:

```bash
export API_KEY="발급키"
export BASE_URL="https://dns.madcamp-kaist.org"
```

### 엔드포인트 표

| 기능 | 메서드 | 경로 |
|------|--------|------|
| 내 정보 | GET | `/v1/me` |
| 서브도메인 목록 | GET | `/v1/subdomains` |
| DNS 레코드 목록 | GET | `/v1/records` |
| 레코드 생성 | POST | `/v1/records` |
| 레코드 수정 | PATCH | `/v1/records/:id` |
| 레코드 삭제 | DELETE | `/v1/records/:id` |
| 터널 생성·조회 | POST / GET | `/v1/tunnels` |
| 터널 호스트네임 추가 | POST | `/v1/tunnels/hostnames` |
| 터널 호스트네임 삭제 | DELETE | `/v1/tunnels/hostnames/:id` |

### KCLOUD 네트워크 제약 (KCLOUD 개괄)

- 실습 VM은 KCLOUD 내부망에 존재하며 외부 접근이 불가합니다. VM과 통신하려면 개발 PC와 클라이언트 모두 KCLOUD VPN 연결이 필요합니다(노트북 ssh도, 모바일 앱의 VM API 호출도 VPN 필요).
- KCLOUD 방화벽은 **22(ssh) / 80(http) / 443(https)** 만 허용합니다. 내부망 자체 방화벽이라 변경 불가합니다. 따라서 3000 / 4173 / 8000 / 8080 등 개발 포트로는 직접 접속할 수 없습니다 → nginx / Caddy / Apache reverse proxy로 80 / 443에 연결하거나 앱을 80 / 443에서 실행하십시오.
- 참고: KCLOUD 대신 AWS / GCP / railway 등 무료 플랜 사용도 가능합니다.

### API 키 발급

- 관리자가 발급합니다. 형태는 `dns_a1b2c3d4e5f6...` 이며 최초 1회만 표시됩니다.
- 분실 시 재발급을 요청하십시오.

### 인증

모든 요청에 `Authorization: Bearer <API키>` 헤더를 포함합니다.

```bash
curl -H "Authorization: Bearer dns_..." https://dns.madcamp-kaist.org/v1/me
```

### 내 계정 정보

`GET /v1/me` → `student{ id, email, subdomain, recordLimit, isActive, createdAt }`

---

## 2. KCLOUD VPN / VM 접속

### VPN 연결

- **PC:** `https://kcloudvpn.kaist.ac.kr/` 에서 KAIST Portal 계정으로 연결합니다.
- **Apple Silicon Mac:** `https://apple.secuwiz.co.kr/u20_mac_down.html` 의 SecuwaySSL을 설치합니다.
- **Mobile:** 모바일 VPN 계정을 사용하고, 안 될 경우 SecuwaySSL VPN U V2.0을 설치합니다.
- 주의: 5회 이상 접속 오류 시 계정이 잠길 수 있습니다.

### VM ssh 접속

- VM 계정 페이지의 username + NAT IP로 ssh 접속합니다.
  - 예: `ssh madcamp01@10.XX.XX.XX`
- initial password로 로그인한 후 `passwd`로 즉시 변경하십시오.

### GPU 사용

- 분반 운영진에게 요청합니다(매주 선착순).
- 분반당 6개.
- 사양: 3090 RTX-20G(1), vCPU 40 core / MEM 50 GB / DISK 100 GB.
- OS: `ubuntu-20-2208-csv`.

---

## 3. DNS 셀프서비스 API

### 3-1. 서브도메인 관리

**목록** `GET /v1/subdomains`
→ `{ primary{subdomain,fqdn}, additional[{id,subdomain,fqdn,createdAt}], additionalUsed, additionalLimit }`

**신청** `POST /v1/subdomains`

```json
{"subdomain":"myproject"}
```

규칙:
- 소문자 영문 / 숫자 / 하이픈
- 1~32자
- 하이픈으로 시작·끝 불가
- 예약어(`www`, `mail`, `smtp`, `ns`, `ns1`, `admin`, `ftp`, `dns` 등) 불가
- 중복 불가
- 추가 최대 5개

**반납** `DELETE /v1/subdomains/:id`
- 아래 DNS 레코드 / 터널 호스트네임이 남아있으면 거부됩니다 → 먼저 삭제하십시오.

### 3-2. DNS 레코드 관리 (CRUD)

**목록** `GET /v1/records`
→ `records[{id,name,fqdn,type,content,ttl,proxied,createdAt,updatedAt}]`

**단건** `GET /v1/records/:id`

**생성** `POST /v1/records`

필드:

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | 필수 | 이름(상대 경로) |
| `type` | 필수 | A / AAAA / CNAME / TXT |
| `content` | 필수 | 레코드 값 |
| `ttl` | 선택 | 기본 1; 1(자동) / 60 / 120 / 300 / 600 / 1800 / 3600 / 86400 |
| `proxied` | 선택 | 기본 false |
| `subdomain` | 선택 | 추가 서브도메인에 생성 시 지정 |

예시:

```json
// 기본 서브도메인 아래
{"name":"www","type":"A","content":"1.2.3.4"}

// 추가 서브도메인 아래
{"name":"www","type":"A","content":"1.2.3.4","subdomain":"myproject"}

// CNAME
{"name":"blog","type":"CNAME","content":"myid.github.io"}

// TXT
{"name":"verify","type":"TXT","content":"google-site-verification=abc123"}

// @ (서브도메인 자체 apex 바인딩)
{"name":"@","type":"A","content":"1.2.3.4"}
// → alice.madcamp-kaist.org 자체 바인딩
```

`name` 규칙:
- 소문자 영문 / 숫자 / 하이픈
- 점으로 최대 3단계
- `@` = 서브도메인 자체(apex) 바인딩
- 빈 문자열 불가
- 와일드카드 · 언더스코어 불가
- 예약어 불가

**수정** `PATCH /v1/records/:id`
- 원하는 필드만 전달합니다.
- `type` 변경 불가(삭제 후 재생성).

**삭제** `DELETE /v1/records/:id` → `{"success":true}`

---

## 4. 터널 (cloudflared)

### 개념

KCLOUD VM은 내부망이라 VPN 없는 외부 방문자는 접근할 수 없습니다. A 레코드로 VM IP를 직접 등록해도 외부 접속은 불가합니다. 터널은 VM 안에서 `cloudflared`를 실행해 Cloudflare로 아웃바운드 연결을 열고, 외부 요청(`team01.madcamp-kaist.org`)이 Cloudflare → 그 연결 → VM `localhost:포트`로 전달되는 방식입니다.

```
브라우저 → Cloudflare → (VM 아웃바운드 연결) → VM localhost:포트
```

- 같은 fqdn에 DNS 레코드와 터널 호스트네임을 동시에 둘 수 없습니다(이름별로는 섞어 사용 가능).
- `recordLimit`은 DNS 레코드 + 터널 호스트네임 합산입니다.

### 설치

**0단계 — cloudflared 설치 (VM당 1회)**

`uname -m`으로 아키텍처를 확인합니다(x86_64 → amd64, aarch64 → arm64).

Ubuntu / Debian:

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
# arm64는 -arm64.deb 사용
sudo dpkg -i cloudflared.deb
cloudflared --version
```

**1단계 — 터널 등록** `POST /v1/tunnels`
→ `{tunnel{id,name}, installCommand:"sudo cloudflared service install ..."}`

**2단계 — VM에서 installCommand 실행**
→ systemd 서비스로 등록됩니다(재부팅 시 자동 재연결).

```bash
sudo systemctl status cloudflared
```

- VM 재생성 시 0단계부터 다시 수행하고 2단계를 재실행합니다(4번 항목의 재수신으로 명령어를 다시 받습니다).

### 터널 상태 및 명령어 재수신

**상태** `GET /v1/tunnels`
→ `tunnel{exists,id,name,hostnames[{id,name,fqdn,localPort,protocol,...}]}` (설치 명령어 미포함)
- 없으면 `{tunnel:{exists:false}}`

**설치 명령어 재수신** `GET /v1/tunnels/token`
→ `{installCommand:...}`
- 터널이 없으면 404.

### 호스트네임 추가 / 삭제

**추가** `POST /v1/tunnels/hostnames`

필드: `subdomain`(필수), `name`(선택, 기본 `"@"`), `localPort`(필수)

```json
// alice.madcamp-kaist.org → localhost:3000
{"subdomain":"alice","localPort":3000}

// api.alice.madcamp-kaist.org → localhost:8080
{"subdomain":"alice","name":"api","localPort":8080}
```

- 같은 서브도메인 아래 `name`만 다르게 여러 개 등록 가능합니다(예: 프론트 `@`=3000, 백엔드 `api`=8080을 하나의 터널로).

**삭제** `DELETE /v1/tunnels/hostnames/:id` → `{success:true, cloudflareCleanup{...}}`

### 포트 / 이름 제약

- `localPort` 범위: **1024 ~ 65535**
- **차단 포트:** 22(SSH) / 3306(MySQL) / 5432(PostgreSQL) / 6379(Redis) / 27017(MongoDB) / 9200(Elasticsearch) 등
- 연결 대상은 항상 VM localhost(127.0.0.1)만 가능
- 프로토콜은 http만 가능
- `name` 규칙은 DNS 레코드와 동일

### ngrok + 수동 CNAME과의 차이

이 API 터널은 별도 가입 · 인증서 · 포트 가드레일 면에서 우월합니다. ngrok 무료 플랜은 커스텀 도메인 인증서 / Host 헤더 문제가 잦습니다.

권장:
- VM에서 직접 서버 공개 → 이 터널
- Vercel / Netlify / GitHub Pages → CNAME
- ngrok류 → 최후 수단

---

## 5. 지원 프로토콜 (되는 것 / 안 되는 것)

| 되는 것 | 안 되는 것 |
|---------|-----------|
| HTTP / HTTPS | 순수 TCP (이 API는 HTTP ingress만) |
| WebSocket (ws/wss, HTTP Upgrade로 통과) | 모든 UDP |
| Socket.IO (WebSocket / 롱폴링 둘 다 통과) | WebRTC 미디어 / 데이터채널 (UDP 기반) |
| SSE | gRPC (HTTP/2 전용 설정 안 켬, 보장 안 함) |
| WebRTC 시그널링 | |

정리:
- 평범한 웹 / REST / WebSocket 채팅 → OK
- 커스텀 TCP · UDP 게임서버, 화상 미디어서버 → 불가

---

## 6. 레코드 타입

| 타입 | 설명 |
|------|------|
| A | IPv4 |
| AAAA | IPv6 |
| CNAME | 별칭, 외부 서비스 연결, 같은 이름 A/AAAA 공존 불가 |
| TXT | 텍스트, 최대 255자 |

---

## 7. Cloudflare Free Tier 제약

- 지원 타입: A / AAAA / CNAME / TXT만 (MX / SRV / CAA 불가)
- TXT 최대 255자
- Cloudflare API 요청 한도: **1200회 / 5분** (캠프 전체 공유)
- `proxied`는 A / AAAA / CNAME만 적용(TXT는 무시)
- DNS 전파 최대 수 분 (TTL 1 자동 ≈ 300초)
- 무료 SLA 없음
- `proxied:true` = Cloudflare 리버스 프록시(실서버 IP 은닉, DDoS 보호 · CDN, A / AAAA / CNAME만)
- TTL 권장: 개발/테스트 60 또는 1, 안정화 후 300, 거의 불변 3600 이상

---

## 8. Rate Limit

- 전체 요청: **30회 / 분**
- 쓰기(POST / PATCH / DELETE): **10회 / 분**
- 초과 시 `429` + `Retry-After` 헤더 반환

> 참고: 위 rate limit은 이 셀프서비스 API 기준이며, 7번의 Cloudflare API 한도(1200회/5분, 캠프 전체 공유)와는 별개입니다.

### 실전 (curl / Postman)

- 환경변수 `API_KEY`, `BASE_URL`을 export하여 사용합니다.
- Postman은 Collection Authorization을 Bearer `{{API_KEY}}`로 설정하고 Environment 변수를 사용합니다.

---

## 9. 오류 코드

형식: `{error{code,message,details}}`

| HTTP | code |
|------|------|
| 400 | `INVALID_REQUEST` |
| 400 | `INVALID_RECORD_NAME` |
| 400 | `UNSUPPORTED_RECORD_TYPE` |
| 400 | `INVALID_RECORD_CONTENT` |
| 401 | `UNAUTHORIZED` |
| 401 | `API_KEY_REVOKED` |
| 403 | `STUDENT_DISABLED` |
| 403 | `FORBIDDEN_RECORD` |
| 403 | `RECORD_LIMIT_EXCEEDED` |
| 404 | `NOT_FOUND` |
| 409 | `DNS_RECORD_CONFLICT` |
| 413 | `INVALID_REQUEST` (바디 64KB 초과) |
| 429 | `RATE_LIMITED` |
| 502 | `CLOUDFLARE_ERROR` |
| 500 | `INTERNAL_ERROR` |

---

## 10. FAQ

- **추가 서브도메인 개념:** 기본 할당 외에 직접 신청하는 서브도메인입니다.
- **반납 전 삭제:** 서브도메인 반납 전 하위 레코드 · 호스트네임을 먼저 삭제해야 합니다.
- **터널 접속이 안 될 때:** `systemctl status` 확인 → `localPort` 서버 동작 확인 → `GET /v1/tunnels` 조회 → 필요 시 VM 재설치.
- **터널로 안 되는 것:** WebRTC 미디어 · 게임서버는 불가(시그널링만 통과).
- **DNS 전파:** TTL만큼 대기하며 `dig` / `nslookup`으로 확인합니다.
- **`DNS_RECORD_CONFLICT`:** 타입 충돌입니다.
- **API 키 Git 유출 시:** 즉시 재발급하고 `.env`로 관리합니다.
- **TXT 255자 초과:** 분리합니다.
- **TXT proxied:** 무시됩니다.
- **무중단 IP 변경:** TTL을 60으로 낮추고 대기 후 변경합니다.
- **오류 보고:** `X-Request-Id`를 함께 전달합니다.
- **문의:** 기술지원부 박지민.
