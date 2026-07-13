# 5080 GPU 워커 셋업·자동화 (대구 개인 PC, Windows)

> 워커는 5080에서만 실행된다(ComfyUI가 localhost). 백엔드·LLM은 아웃바운드로만 접근 → NAT 안전.
> 연결: 워커→백엔드 = 공개 `sunboy7594-game`(VPN 불필요), 워커→ComfyUI = localhost, 워커→3090 LLM = SSH 터널(선택).

## 0. 사전 준비 (5080에 1회)
- **Node.js 20.12+** (`process.loadEnvFile` 내장 사용).
- **ComfyUI** 실행 중 + `config/comfyui/workflow.i2v.json`이 참조하는 모델 파일이 `C:\dev\ComfyUI\models\...`에 존재:
  - UNET(GGUF): `Wan2.2-I2V-A14B-HighNoise-Q5_K_S.gguf`, `...-LowNoise-Q5_K_S.gguf`
  - LoRA: `wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors`, `...low_noise.safetensors`
  - (파일명이 다르면 `gpu-worker/config/pipeline.json`의 model 섹션을 실제 파일명에 맞춤)

## 1. 코드·의존성
```powershell
cd C:\dev
git clone https://github.com/madcamp-official/26s-w2-c3-08 game   # 이미 있으면 생략
cd game
git checkout kjh/integrate
git pull
npm install                                  # 루트 워크스페이스(sharp 포함) 설치
```

## 2. 환경 설정
```powershell
cd C:\dev\game\gpu-worker
copy .env.example .env
# .env 편집: SERVER_URL/COMFYUI_URL 확인. LLM은 일단 스텁(주석 그대로) — 3090 없이 검증.
```

## 3. 수동 실행 (자동화 전 반드시 1회 증명)
```powershell
cd C:\dev\game\gpu-worker
npm start        # = tsx src/index.ts, .env 자동 로드
# 로그: "[worker] 시작 — server=... comfyui=... llm=STUB"
#       ComfyUI 헬스 OK 확인. 이후 큐 폴링(204면 조용히 대기).
```
이 상태에서 백엔드에 잡을 넣으면(팀 KJH가 `genasset` 또는 `/api/asset/submit`) 워커가 집어
생성→업로드하고, `https://sunboy7594-game.madcamp-kaist.org/storage/sprites/{id}.png`에 시트가 뜬다.

## 4. 자동화(상시화) — Windows 서비스
수동 증명 후. 두 가지 중 택1:

### (A) NSSM — 권장(자동재시작+부팅시작, Windows 친화)
```powershell
# https://nssm.cc 설치 후
nssm install comfyui   "C:\dev\ComfyUI\... (ComfyUI 실행 배치/파이썬)"
nssm install gpuworker "C:\Program Files\nodejs\npm.cmd" "start"
nssm set gpuworker AppDirectory C:\dev\game\gpu-worker
nssm start comfyui; nssm start gpuworker
```

### (B) pm2 — VM과 동일 도구
```powershell
npm i -g pm2 pm2-windows-startup
pm2-startup install
cd C:\dev\game\gpu-worker
pm2 start npm --name gpuworker -- start
pm2 save
```

## 5. (선택) 실제 LLM — 3090 게이트웨이 터널 상시화
스텁 대신 진짜 외형 프롬프트를 쓰려면(3090 `:8001`은 방화벽에 막혀 SSH 터널 필요, VPN 상태):
```powershell
# 상시 터널 (autossh 권장, 없으면 스케줄 작업으로 재접속)
ssh -N -L 8001:127.0.0.1:8001 root@172.10.5.138
```
그 뒤 `.env`에서 `QWEN_GATEWAY_URL`/`QWEN_INTERNAL_TOKEN` 주석 해제.
⚠️ VPN은 단일세션 — 5080에서 VPN 잡으면 다른 곳(개발 PC) VPN 불가.

## 주의
- 백엔드 큐 API가 현재 **무인증**(공개). 운영 전 `WORKER_TOKEN`을 백엔드·워커 양쪽에 설정 권장.
- ComfyUI 응답 형태(`/history`·`/view`)·Wan `length` 제약은 첫 실행 시 `client.ts`의 `// TODO: 5080 실측` 지점에서 검증·조정.
