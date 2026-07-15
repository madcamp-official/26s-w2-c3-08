# 5080 GPU 워커 상시 구동 스크립트.
# 이 창 하나만 켜두면: node PATH·`.env`·의존성 설치를 알아서 확인하고, 매 (재)시작 전 ComfyUI VRAM을
# 비운 뒤 워커를 띄운다. 워커 프로세스가 죽으면(크래시) 자동으로 재시작한다.
#
# ⚠️ 이 스크립트가 자동화 못 하는 것 - 여전히 수동:
#   - KCLOUD VPN 연결
#   - 3090 게이트웨이 SSH 터널(ssh -N -L 8001:127.0.0.1:8001 root@172.10.5.138) - 별도 창에서 계속 띄워둘 것
#   - 둘 다 없어도 워커는 스텁(llm=STUB) 모드로 ComfyUI만으로 정상 동작한다.
#
# 사용: PowerShell에서 `./scripts/run-worker.ps1` (gpu-worker 디렉터리에서, 또는 어디서든 실행 가능 -
# 스크립트 자신의 위치 기준으로 경로를 잡는다).
param(
  [string]$ComfyUrl = "http://127.0.0.1:8188",
  [int]$RestartDelaySec = 5
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot  # gpu-worker/
Set-Location $root

if (-not (Test-Path "C:\Program Files\nodejs\node.exe")) {
  Write-Error "Node.js가 C:\Program Files\nodejs 에 없습니다. 설치를 확인하세요."
  exit 1
}
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

if (-not (Test-Path ".env")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
    Write-Output "[setup] .env 없어서 .env.example을 복사했습니다. 게이트웨이를 쓰려면 QWEN_GATEWAY_URL 주석을 해제하세요."
  } else {
    Write-Error ".env도 .env.example도 없습니다 - gpu-worker 디렉터리 확인 필요."
    exit 1
  }
}

if (-not (Test-Path "node_modules")) {
  Write-Output "[setup] node_modules 없음 - npm install 실행 (루트 워크스페이스 기준, 시간 걸릴 수 있음)"
  Push-Location (Split-Path -Parent $root)
  npm install
  $installExit = $LASTEXITCODE
  Pop-Location
  if ($installExit -ne 0) { Write-Error "npm install 실패(exit $installExit)"; exit 1 }
}

function Free-ComfyVram {
  try {
    Invoke-RestMethod -Method Post -Uri "$ComfyUrl/free" -ContentType "application/json" `
      -Body '{"unload_models":true,"free_memory":true}' -TimeoutSec 15 | Out-Null
    Write-Output "[setup] ComfyUI VRAM 확보 완료"
  } catch {
    Write-Output "[setup] ComfyUI VRAM 확보 실패(무시하고 계속 - ComfyUI 미기동일 수 있음): $($_.Exception.Message)"
  }
}

Write-Output "[supervisor] 워커 상시 구동 시작 - 죽으면 ${RestartDelaySec}초 후 자동 재시작. 중단은 Ctrl+C."
while ($true) {
  Free-ComfyVram
  Write-Output "[supervisor] npm start 실행 $(Get-Date -Format HH:mm:ss)"
  npm start
  Write-Output "[supervisor] 워커 종료됨(exit $LASTEXITCODE) - ${RestartDelaySec}초 후 재시작"
  Start-Sleep -Seconds $RestartDelaySec
}
