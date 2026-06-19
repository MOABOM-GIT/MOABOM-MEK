#!/usr/bin/env bash
# Moabom 로컬 — Reverb(WebSocket) 드라이버 설정 ON + reverb 컨테이너 기동
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker 가 필요합니다." >&2
  exit 1
fi

docker compose exec app php ../scripts/enable-moabom-reverb-settings.php
docker compose up -d reverb

echo ""
echo "완료. 관리자 > 환경설정 > 드라이버에서 WebSocket 이 활성화되었는지 확인하세요."
echo "Reverb: docker compose logs -f reverb"
