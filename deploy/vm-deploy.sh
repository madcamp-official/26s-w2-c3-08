#!/usr/bin/env bash
# VM(172.10.7.247, /root/game)에서 실행하는 배포 스크립트.
# 항상 서버·클라 둘 다 재빌드·재시작한다 — "이번엔 client/ 안 바뀌었으니 재빌드 생략"
# 판단을 아예 없애 실수(클라 재빌드 누락)를 구조적으로 막는다.
# 사용: ssh로 이 스크립트를 실행. DB 마이그레이션은 별도(migrate deploy는 스키마 변경 시에만 수동).
set -euo pipefail
cd /root/game

echo "== git pull =="
git pull --ff-only

echo "== npm install =="
npm install

# prisma migrate deploy는 migrate dev와 달리 클라이언트를 자동 재생성하지 않는다(2026-07-15 실측
# 버그 — 마이그레이션 적용 후 서버가 신규 컬럼을 "Unknown argument"로 계속 거부했음).
# 스키마 변경 여부와 무관하게 매번 generate — 이것도 재발 방지 위해 조건부 판단 없앰.
echo "== prisma generate =="
(cd server && npx prisma generate)

echo "== client build =="
cd client
VITE_DEV_CONSOLE=1 VITE_SERVER_URL=wss://sunboy7594-game.madcamp-kaist.org npx vite build
cd ..

echo "== restart =="
pm2 restart game-server game-client

echo "== done =="
pm2 ls
