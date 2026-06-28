#!/usr/bin/env bash
# Realtime VM health probe — Cloud Run 배포와 독립된 Reverb SSOT 확인.
set -euo pipefail

HOST="${MOABOM_REALTIME_HOST:-realtime.mek360.com}"
APP_KEY="${REVERB_APP_KEY:-moabom-laravel-key}"
SSH_HOST="${MOABOM_REALTIME_SSH_HOST:-moabom-realtime-prod}"
CHECK_SSH="${MOABOM_REALTIME_VM_SSH:-0}"
URL="https://${HOST}/app/${APP_KEY}?protocol=7&client=js&version=8.4.0&flash=false"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "==> Realtime VM public WebSocket upgrade (${HOST})"
response="$(curl --http1.1 -sS -i -m 6 \
  -H 'Connection: Upgrade' \
  -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  "${URL}" 2>/dev/null || true)"

grep -q '101 Switching Protocols' <<<"${response}" \
  || fail "public WebSocket upgrade did not return HTTP 101"
grep -q 'pusher:connection_established' <<<"${response}" \
  || fail "public WebSocket upgrade did not establish Pusher connection"
echo "OK: public WebSocket upgrade"

if [[ "${CHECK_SSH}" != "1" ]]; then
  echo "SKIP: VM SSH service check (set MOABOM_REALTIME_VM_SSH=1)"
  exit 0
fi

echo "==> Realtime VM SSH services (${SSH_HOST})"
ssh "${SSH_HOST}" 'set -e
  systemctl is-active nginx >/dev/null
  sudo -n docker compose -f /opt/moabom-realtime/docker-compose.yml ps --status running | grep -q moabom-realtime-reverb
  sudo -n docker compose -f /opt/moabom-realtime/docker-compose.yml ps --status running | grep -q moabom-realtime-redis
'
echo "OK: VM nginx/reverb/redis running"
