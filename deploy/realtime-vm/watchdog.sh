#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/moabom-realtime}"

if ! systemctl is-active --quiet nginx || ! nginx -t >/dev/null 2>&1; then
  systemctl restart nginx
fi

cd "${INSTALL_DIR}"
if [[ "$(docker compose exec -T redis redis-cli ping 2>/dev/null || true)" != "PONG" ]]; then
  docker compose up -d --no-build redis
  docker compose restart reverb
  sleep 3
fi

if ! timeout 3 bash -c '</dev/tcp/127.0.0.1/6001' 2>/dev/null; then
  docker compose up -d --no-build redis reverb
  sleep 3
fi

[[ "$(docker compose exec -T redis redis-cli ping 2>/dev/null || true)" == "PONG" ]]
timeout 3 bash -c '</dev/tcp/127.0.0.1/6001' 2>/dev/null
