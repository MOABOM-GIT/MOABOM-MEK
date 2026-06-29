#!/usr/bin/env bash
# Realtime VM lightweight metrics — nginx admin에서 token 인증 후 호출.
set -euo pipefail

read_cpu_percent() {
  if [[ -r /proc/stat ]]; then
    awk '/^cpu / {idle=$5; total=0; for (i=2;i<=NF;i++) total+=$i; if (total>0) printf "%.1f", (total-idle)*100/total; else print "0"}' /proc/stat
  else
    echo "0"
  fi
}

read_mem_percent() {
  if command -v free >/dev/null 2>&1; then
    free | awk '/Mem:/ {printf "%.1f", ($3/$2)*100}'
  else
    echo "0"
  fi
}

read_disk_percent() {
  df -P / | awk 'NR==2 {gsub("%","",$5); print $5}'
}

docker_running() {
  local name="$1"
  if command -v docker >/dev/null 2>&1; then
    docker ps --format '{{.Names}}' 2>/dev/null | grep -qE "^${name}(-[0-9]+)?$" && echo true || echo false
  else
    echo false
  fi
}

redis_container() {
  if command -v docker >/dev/null 2>&1; then
    docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^moabom-realtime-redis' | head -1
  fi
}

redis_clients() {
  local c
  c="$(redis_container)"
  if [[ -n "${c}" ]]; then
    docker exec "${c}" redis-cli INFO clients 2>/dev/null | awk -F: '/connected_clients/ {gsub("\r","",$2); print $2; exit}' || echo 0
  else
    echo 0
  fi
}

redis_memory_mb() {
  local c
  c="$(redis_container)"
  if [[ -n "${c}" ]]; then
    docker exec "${c}" redis-cli INFO memory 2>/dev/null | awk -F: '/used_memory_human/ {gsub("\r","",$2); print $2; exit}' || echo "0B"
  else
    echo "0B"
  fi
}

load_avg="$(awk '{print $1" "$2" "$3}' /proc/loadavg 2>/dev/null || echo '0 0 0')"
uptime_sec="$(cut -d. -f1 /proc/uptime 2>/dev/null || echo 0)"

if [[ -n "${GATEWAY_INTERFACE:-}" ]]; then
  printf 'Content-Type: application/json\r\n\r\n'
fi

cat <<EOF
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "host": "$(hostname)",
  "uptime_seconds": ${uptime_sec},
  "load_avg": "${load_avg}",
  "cpu_percent": $(read_cpu_percent),
  "memory_percent": $(read_mem_percent),
  "disk_percent": $(read_disk_percent),
  "processes": {
    "nginx": $(systemctl is-active nginx >/dev/null 2>&1 && echo true || echo false),
    "reverb": $(docker_running moabom-realtime-reverb),
    "redis": $(docker_running moabom-realtime-redis)
  },
  "redis": {
    "connected_clients": $(redis_clients),
    "used_memory_human": "$(redis_memory_mb)"
  }
}
EOF
