#!/usr/bin/env bash
# Realtime VM health probe — Cloud Run 배포와 독립된 Reverb SSOT 확인.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/gcp-env.sh
source "${ROOT}/deploy/lib/gcp-env.sh"

HOST="${MOABOM_REALTIME_HOST:-realtime.mek360.com}"
APP_ID="${REVERB_APP_ID:-moabom-laravel}"
APP_KEY="${REVERB_APP_KEY:-moabom-laravel-key}"
SSH_HOST="${MOABOM_REALTIME_SSH_HOST:-moabom-realtime-prod}"
CHECK_SSH="${MOABOM_REALTIME_VM_SSH:-0}"
CHECK_PUBLISH="${MOABOM_REALTIME_PUBLISH_CHECK:-1}"
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

if [[ "${CHECK_PUBLISH}" = "1" ]]; then
  echo "==> Realtime VM authenticated publish"
  secret_file="$(mktemp)"
  trap 'rm -f "${secret_file}"' EXIT
  chmod 600 "${secret_file}"
  if [[ -n "${REVERB_APP_SECRET:-}" ]]; then
    printf '%s' "${REVERB_APP_SECRET}" >"${secret_file}"
  else
    command -v gcloud >/dev/null 2>&1 \
      || fail "gcloud 없음 — MOABOM_REALTIME_PUBLISH_CHECK=0 또는 REVERB_APP_SECRET 필요"
    gcloud secrets versions access latest \
      --secret="${SECRET_REVERB_APP_SECRET}" \
      --project="$(moabom_gcp_project)" >"${secret_file}" 2>/dev/null \
      || fail "Secret Manager ${SECRET_REVERB_APP_SECRET} 읽기 실패"
  fi
  [[ -s "${secret_file}" ]] || fail "Reverb app secret 비어 있음"

  python3 - "${HOST}" "${APP_ID}" "${APP_KEY}" "${secret_file}" <<'PY' \
    || fail "authenticated publish did not return HTTP 2xx"
import hashlib
import hmac
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

host, app_id, app_key, secret_path = sys.argv[1:5]
secret = pathlib.Path(secret_path).read_text(encoding="utf-8").rstrip("\r\n")
path = f"/apps/{app_id}/events"
body = json.dumps(
    {
        "name": "moabom.health",
        "channels": [f"private-moabom.health.{uuid.uuid4()}"],
        "data": json.dumps({"probe": True}, separators=(",", ":")),
    },
    separators=(",", ":"),
).encode()
params = {
    "auth_key": app_key,
    "auth_timestamp": str(int(time.time())),
    "auth_version": "1.0",
    "body_md5": hashlib.md5(body).hexdigest(),
}
query = urllib.parse.urlencode(sorted(params.items()))
signing = f"POST\n{path}\n{query}".encode()
params["auth_signature"] = hmac.new(secret.encode(), signing, hashlib.sha256).hexdigest()
url = f"https://{host}{path}?{urllib.parse.urlencode(sorted(params.items()))}"
request = urllib.request.Request(
    url,
    data=body,
    method="POST",
    headers={"Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(request, timeout=8) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"HTTP {response.status}")
        print(f"OK: authenticated publish HTTP {response.status}")
except urllib.error.HTTPError as error:
    print(f"ERROR: authenticated publish HTTP {error.code}", file=sys.stderr)
    raise
PY
fi

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
