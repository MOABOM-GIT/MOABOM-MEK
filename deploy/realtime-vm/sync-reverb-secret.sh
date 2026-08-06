#!/usr/bin/env bash
# Secret Manager의 Reverb secret을 VM .env에 원자적으로 동기화합니다.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/moabom-realtime}"
GCP_PROJECT="${GCP_PROJECT:-smartmek}"
SECRET_NAME="${SECRET_NAME:-moabom-reverb-app-secret}"
RESTART=0
SECRET_STDIN=0

for arg in "$@"; do
  case "${arg}" in
    --restart) RESTART=1 ;;
    --secret-stdin) SECRET_STDIN=1 ;;
    *)
      echo "ERROR: unknown argument: ${arg}" >&2
      exit 2
      ;;
  esac
done

ENV_FILE="${INSTALL_DIR}/.env"
[[ -f "${ENV_FILE}" ]] || {
  echo "ERROR: ${ENV_FILE} 없음 — install-on-vm.sh를 먼저 실행하세요." >&2
  exit 1
}

secret_file="$(mktemp)"
trap 'rm -f "${secret_file}"' EXIT
chmod 600 "${secret_file}"
if [[ "${SECRET_STDIN}" = "1" ]]; then
  cat >"${secret_file}"
else
  gcloud secrets versions access latest \
    --secret="${SECRET_NAME}" \
    --project="${GCP_PROJECT}" >"${secret_file}" 2>/dev/null
fi
[[ -s "${secret_file}" ]] || {
  echo "ERROR: Secret Manager ${SECRET_NAME} 값이 비어 있습니다." >&2
  exit 1
}

changed="$(
  python3 - "${ENV_FILE}" "${secret_file}" <<'PY'
import os
import pathlib
import sys
import tempfile

path = pathlib.Path(sys.argv[1])
secret = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8").rstrip("\r\n")
key = "REVERB_APP_SECRET"
lines = path.read_text(encoding="utf-8").splitlines()
replacement = f"{key}={secret}"
found = False
changed = False
out: list[str] = []

for line in lines:
    if line.startswith(f"{key}="):
        found = True
        changed = changed or line != replacement
        out.append(replacement)
    else:
        out.append(line)

if not found:
    out.append(replacement)
    changed = True

if changed:
    fd, tmp_name = tempfile.mkstemp(prefix=".env.", dir=str(path.parent), text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write("\n".join(out) + "\n")
        os.chmod(tmp_name, 0o600)
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)

print("1" if changed else "0")
PY
)"

if [[ "${changed}" = "1" ]]; then
  echo "OK: ${SECRET_NAME} → ${ENV_FILE} 동기화 완료"
else
  echo "OK: ${ENV_FILE} secret 이미 최신"
fi

if [[ "${RESTART}" = "1" && "${changed}" = "1" ]]; then
  echo "==> Reverb container recreate"
  docker compose -f "${INSTALL_DIR}/docker-compose.yml" up -d --force-recreate --no-deps reverb
fi
