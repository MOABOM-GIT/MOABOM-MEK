#!/usr/bin/env bash
# Moabom realtime VM bootstrap — run on moabom-realtime-prod as root.
# SSOT: deploy/moabom-realtime-vm.md
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/moabom-realtime}"
GCP_PROJECT="${GCP_PROJECT:-smartmek}"
SECRET_NAME="${SECRET_NAME:-moabom-reverb-app-secret}"
METRICS_SECRET_NAME="${METRICS_SECRET_NAME:-moabom-realtime-vm-metrics-token}"
WS_HOST="${WS_HOST:-realtime.mek360.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METRICS_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --metrics-only) METRICS_ONLY=1 ;;
  esac
done

log() { printf '[moabom-realtime] %s\n' "$*"; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    log "Run as root: sudo $0"
    exit 1
  fi
}

install_packages() {
  log "Installing packages..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq \
    ca-certificates curl gnupg nginx certbot python3-certbot-nginx \
    git rsync
  if ! command -v docker >/dev/null 2>&1; then
    apt-get install -y -qq docker.io
  fi
  if ! docker compose version >/dev/null 2>&1; then
    log "Installing Docker Compose plugin..."
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL \
      "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  fi
  systemctl enable --now docker nginx
}

ensure_swap() {
  if swapon --show | grep -q '/swapfile'; then
    return
  fi
  log "Adding 1G swap (e2-micro build headroom)..."
  fallocate -l 1G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=1024
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
}

sync_stack() {
  log "Syncing stack to ${INSTALL_DIR}..."
  mkdir -p "${INSTALL_DIR}"
  rsync -a --delete \
    --exclude '.env' \
    "${SCRIPT_DIR}/" "${INSTALL_DIR}/"
}

write_env() {
  log "Writing .env..."
  local app_key
  if [[ -f "${INSTALL_DIR}/.env" ]]; then
    log ".env exists — syncing REVERB_APP_SECRET from Secret Manager"
    chmod +x "${INSTALL_DIR}/sync-reverb-secret.sh"
    INSTALL_DIR="${INSTALL_DIR}" \
      GCP_PROJECT="${GCP_PROJECT}" \
      SECRET_NAME="${SECRET_NAME}" \
      "${INSTALL_DIR}/sync-reverb-secret.sh"
    return
  fi
  app_key="base64:$(openssl rand -base64 32)"
  sed \
    -e "s|^REVERB_APP_SECRET=.*|REVERB_APP_SECRET=|" \
    -e "s|^APP_KEY=.*|APP_KEY=${app_key}|" \
    "${INSTALL_DIR}/env.example" > "${INSTALL_DIR}/.env"
  chmod 600 "${INSTALL_DIR}/.env"
  chmod +x "${INSTALL_DIR}/sync-reverb-secret.sh"
  INSTALL_DIR="${INSTALL_DIR}" \
    GCP_PROJECT="${GCP_PROJECT}" \
    SECRET_NAME="${SECRET_NAME}" \
    "${INSTALL_DIR}/sync-reverb-secret.sh"
}

compose_up() {
  log "Building and starting Docker stack (may take several minutes)..."
  cd "${INSTALL_DIR}"
  docker compose build --progress=plain
  docker compose up -d
  sleep 3
  docker compose ps
  if ! ss -tln | grep -q ':6001'; then
    log "ERROR: Reverb not listening on 6001"
    docker compose logs --tail=80 reverb
    exit 1
  fi
  log "Reverb listening on 127.0.0.1:6001"
}

install_watchdog() {
  log "Installing realtime auto-recovery watchdog..."
  chmod +x "${INSTALL_DIR}/watchdog.sh"
  cp "${INSTALL_DIR}/moabom-realtime-watchdog.service" /etc/systemd/system/
  cp "${INSTALL_DIR}/moabom-realtime-watchdog.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now moabom-realtime-watchdog.timer
}

install_nginx_http_bootstrap() {
  log "Installing HTTP bootstrap nginx (pre-certbot)..."
  mkdir -p /var/www/certbot
  cat > /etc/nginx/sites-available/moabom-realtime-bootstrap.conf <<EOF
server {
    listen 80;
    server_name ${WS_HOST};
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location ^~ /app/moabom-laravel-key {
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_pass http://127.0.0.1:6001;
    }
    location ^~ /apps/ {
        proxy_pass http://127.0.0.1:6001;
        proxy_set_header Host \$host;
    }
    location / {
        return 200 'moabom-realtime ok\n';
        add_header Content-Type text/plain;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/moabom-realtime-bootstrap.conf /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
}

issue_tls() {
  log "Requesting TLS cert for ${WS_HOST}..."
  if certbot certificates 2>/dev/null | grep -q "${WS_HOST}"; then
    log "Certificate already exists"
  else
    certbot certonly --webroot -w /var/www/certbot \
      -d "${WS_HOST}" \
      --non-interactive --agree-tos \
      -m "admin@${WS_HOST#*.}" || {
        log "WARN: certbot failed — ensure DNS A record ${WS_HOST} → this VM IP, then re-run: certbot certonly ..."
        return 0
      }
  fi
}

install_nginx_site() {
  cp "${INSTALL_DIR}/nginx/realtime.mek360.com.conf" /etc/nginx/sites-available/moabom-realtime.conf
  ln -sf /etc/nginx/sites-available/moabom-realtime.conf /etc/nginx/sites-enabled/moabom-realtime.conf
  rm -f /etc/nginx/sites-enabled/moabom-realtime-bootstrap.conf
  nginx -t && systemctl reload nginx
}

firewall_hint() {
  log "Ensure GCP firewall allows tcp:80,tcp:443 to this instance tag."
  log "Example: gcloud compute firewall-rules create moabom-realtime-https --allow=tcp:80,tcp:443 --target-tags=..."
}

install_vm_metrics() {
  log "Installing VM metrics endpoint (fcgiwrap + token auth)..."
  apt-get install -y -qq fcgiwrap
  usermod -aG docker moabom 2>/dev/null || true

  mkdir -p /etc/systemd/system/fcgiwrap.service.d /etc/moabom
  cat > /etc/systemd/system/fcgiwrap.service.d/override.conf <<'EOF'
[Service]
User=moabom
Group=docker
EOF
  systemctl daemon-reload
  systemctl enable --now fcgiwrap

  chmod +x "${INSTALL_DIR}/metrics/moabom-vm-metrics.sh"

  local token
  token="${METRICS_TOKEN:-}"
  if [[ -z "${token}" ]]; then
    token="$(gcloud secrets versions access latest --secret="${METRICS_SECRET_NAME}" --project="${GCP_PROJECT}" 2>/dev/null || true)"
  fi
  if [[ -z "${token}" ]]; then
    token="$(openssl rand -base64 32)"
    log "Creating Secret Manager secret ${METRICS_SECRET_NAME}..."
    if ! gcloud secrets describe "${METRICS_SECRET_NAME}" --project="${GCP_PROJECT}" >/dev/null 2>&1; then
      echo -n "${token}" | gcloud secrets create "${METRICS_SECRET_NAME}" \
        --replication-policy=automatic \
        --data-file=- \
        --project="${GCP_PROJECT}"
    else
      echo -n "${token}" | gcloud secrets versions add "${METRICS_SECRET_NAME}" \
        --data-file=- \
        --project="${GCP_PROJECT}"
    fi
    log "NOTE: deploy host 에서 bash deploy/build-and-deploy.sh --env-only 로 Cloud Run 토큰 반영"
  fi

  echo -n "${token}" > /etc/moabom/metrics-token
  chmod 600 /etc/moabom/metrics-token
  printf '"%s" 1;\n' "${token}" > /etc/nginx/moabom-metrics-token.map
  chmod 640 /etc/nginx/moabom-metrics-token.map
  chown root:www-data /etc/nginx/moabom-metrics-token.map 2>/dev/null || true

  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
  fi
  log "VM metrics ready: GET https://${WS_HOST}/internal/vm-metrics (X-Moabom-Metrics-Token)"
}

main() {
  require_root
  if [[ "${METRICS_ONLY}" -eq 1 ]]; then
    sync_stack
    install_vm_metrics
    install_nginx_site
    log "Done (metrics-only)."
    return
  fi
  install_packages
  ensure_swap
  sync_stack
  write_env
  compose_up
  install_watchdog
  install_nginx_http_bootstrap
  issue_tls
  install_vm_metrics
  install_nginx_site
  firewall_hint
  log "Done. Test: curl -sI http://127.0.0.1:6001 || curl -s http://localhost/app/moabom-laravel-key"
}

main "$@"
