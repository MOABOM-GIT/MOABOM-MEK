#!/usr/bin/env bash
# Secret Manager 부트스트랩 — DB 패스워드 / APP_KEY / SNS OAuth client_secret 을
# Google Secret Manager 로 옮기고, Cloud Run service account 에 secretAccessor 권한 부여.
#
# 멱등: 이미 같은 값의 latest 버전이 존재하면 skip / 다르면 새 버전 추가 / 시크릿 없으면 생성.
#
# 사용:
#   1) (1회) bash deploy/secret-manager-bootstrap.sh --from-file deploy/production.env.yaml.plaintext
#      - deploy/production.env.yaml.plaintext 는 git ignore 되는 백업 파일
#      - 또는 환경변수로 직접 전달 (CI):
#          DB_PASSWORD=... APP_KEY=... \
#          SOCIAL_NAVER_SECRET=... SOCIAL_KAKAO_SECRET=... SOCIAL_GOOGLE_SECRET=... \
#          bash deploy/secret-manager-bootstrap.sh --from-env
#   2) deploy/production.env.yaml 에서 시크릿 키 라인을 제거 (이 스크립트가 자동 처리: --strip-env)
#   3) bash deploy/build-and-deploy.sh --env-only
#
# 인프라 식별자·시크릿 이름 SSOT: deploy/lib/gcp-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/gcp-env.sh
source "${ROOT}/deploy/lib/gcp-env.sh"

PROJECT="$(moabom_gcp_project)"
REGION="$(moabom_gcp_region)"
SERVICE="$(moabom_gcp_cloud_run_service)"

SOURCE_MODE=""
SOURCE_FILE=""
STRIP_ENV=0
GRANT_IAM=1

AI_KEYS_ONLY=0
REVERB_ONLY=0

usage() {
  cat <<EOF
Usage: $0 [options]
  --from-file FILE   FILE (key=value 형식 또는 yaml) 에서 평문값 읽기
                     기본값: deploy/production.env.yaml (현재 평문 시크릿이 있는 상태)
  --from-env         환경변수 (DB_PASSWORD / APP_KEY / SOCIAL_*_SECRET) 에서 읽기
  --ai-keys-only     MOABOM_OPENAI_API_KEY / MOABOM_ANTHROPIC_API_KEY / MOABOM_GOOGLE_AI_API_KEY 만
                     Secret Manager 로 동기화 (DB·OAuth 시크릿 단계 생략)
  --reverb-only      REVERB_APP_SECRET 만 Secret Manager 로 동기화
  --strip-env        부트스트랩 성공 후 deploy/production.env.yaml 에서
                     시크릿 키 라인을 자동 제거 (백업: .bak)
  --no-iam           Cloud Run service account 권한 부여 단계 생략
  -h, --help         이 도움말

기본 동작 (인자 없음): --from-file deploy/production.env.yaml
시크릿 매핑 / 이름은 deploy/lib/gcp-env.sh SSOT 만 사용.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --from-file) SOURCE_MODE="file"; shift ;;
    --from-env) SOURCE_MODE="env" ;;
    --ai-keys-only) AI_KEYS_ONLY=1 ;;
    --reverb-only) REVERB_ONLY=1 ;;
    --strip-env) STRIP_ENV=1 ;;
    --no-iam) GRANT_IAM=0 ;;
    -h|--help) usage; exit 0 ;;
    --*) ;;
    *)
      if [[ "${SOURCE_MODE}" == "file" && -z "${SOURCE_FILE}" ]]; then
        SOURCE_FILE="$arg"
      else
        echo "Unknown arg: $arg"; usage; exit 1
      fi
      ;;
  esac
done

if [[ -z "${SOURCE_MODE}" ]]; then
  SOURCE_MODE="file"
  SOURCE_FILE="${ROOT}/deploy/production.env.yaml"
fi

# ── 값 로드 (stdout 에 출력하지 않음 — 평문 누출 방지) ────────────────────────
load_from_yaml_value() {
  local file="$1" key="$2"
  # 'KEY: "value"' 또는 'KEY: value' 형식 (production.env.yaml)
  grep -E "^${key}: " "${file}" 2>/dev/null \
    | head -1 \
    | sed -E "s/^${key}: //; s/^\"(.*)\"\$/\1/; s/^'(.*)'\$/\1/"
}

if [[ "${SOURCE_MODE}" == "file" ]]; then
  [[ -f "${SOURCE_FILE}" ]] || { echo "ERROR: source file 없음: ${SOURCE_FILE}"; exit 1; }
  echo "==> 평문 값 로드: ${SOURCE_FILE}"
  if [[ "${AI_KEYS_ONLY}" -eq 1 ]]; then
    MOABOM_OPENAI_API_KEY="$(load_from_yaml_value "${SOURCE_FILE}" MOABOM_OPENAI_API_KEY)"
    MOABOM_ANTHROPIC_API_KEY="$(load_from_yaml_value "${SOURCE_FILE}" MOABOM_ANTHROPIC_API_KEY)"
    MOABOM_GOOGLE_AI_API_KEY="$(load_from_yaml_value "${SOURCE_FILE}" MOABOM_GOOGLE_AI_API_KEY)"
  elif [[ "${REVERB_ONLY}" -eq 1 ]]; then
    REVERB_APP_SECRET_VAL="$(load_from_yaml_value "${SOURCE_FILE}" REVERB_APP_SECRET)"
  else
    DB_PASSWORD="$(load_from_yaml_value "${SOURCE_FILE}" DB_WRITE_PASSWORD)"
    APP_KEY_VAL="$(load_from_yaml_value "${SOURCE_FILE}" APP_KEY)"
    SOCIAL_NAVER_SECRET="$(load_from_yaml_value "${SOURCE_FILE}" SOCIAL_AUTH_MASTER_NAVER_CLIENT_SECRET)"
    SOCIAL_KAKAO_SECRET="$(load_from_yaml_value "${SOURCE_FILE}" SOCIAL_AUTH_MASTER_KAKAO_CLIENT_SECRET)"
    SOCIAL_GOOGLE_SECRET="$(load_from_yaml_value "${SOURCE_FILE}" SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_SECRET)"
  fi
fi
# --from-env: 그대로 사용 (사전에 export 된 변수)

if [[ "${AI_KEYS_ONLY}" -eq 1 ]]; then
  : "${MOABOM_OPENAI_API_KEY:?MOABOM_OPENAI_API_KEY 없음}"
  : "${MOABOM_ANTHROPIC_API_KEY:?MOABOM_ANTHROPIC_API_KEY 없음}"
  : "${MOABOM_GOOGLE_AI_API_KEY:?MOABOM_GOOGLE_AI_API_KEY 없음}"
elif [[ "${REVERB_ONLY}" -eq 1 ]]; then
  : "${REVERB_APP_SECRET_VAL:=${REVERB_APP_SECRET:-}}"
  : "${REVERB_APP_SECRET_VAL:?REVERB_APP_SECRET 없음 — env REVERB_APP_SECRET 또는 --from-file}"
else
  : "${DB_PASSWORD:?DB_PASSWORD 없음 — --from-file 의 DB_WRITE_PASSWORD 또는 env DB_PASSWORD 필요}"
  : "${APP_KEY_VAL:=${APP_KEY:-}}"
  : "${APP_KEY_VAL:?APP_KEY 없음 — --from-file 의 APP_KEY 또는 env APP_KEY 필요}"
  : "${SOCIAL_NAVER_SECRET:?SOCIAL_NAVER_SECRET 없음}"
  : "${SOCIAL_KAKAO_SECRET:?SOCIAL_KAKAO_SECRET 없음}"
  : "${SOCIAL_GOOGLE_SECRET:?SOCIAL_GOOGLE_SECRET 없음}"
fi

# ── Secret Manager 생성/업데이트 (멱등) ──────────────────────────────────────
ensure_secret() {
  local secret_name="$1" value="$2"

  if ! gcloud secrets describe "${secret_name}" --project="${PROJECT}" >/dev/null 2>&1; then
    echo "    create: ${secret_name}"
    gcloud secrets create "${secret_name}" \
      --project="${PROJECT}" \
      --replication-policy=automatic \
      --quiet >/dev/null
  fi

  local current
  current="$(gcloud secrets versions access latest \
    --secret="${secret_name}" --project="${PROJECT}" 2>/dev/null || true)"

  if [[ "${current}" == "${value}" ]]; then
    echo "    skip   (latest 동일): ${secret_name}"
  else
    echo "    add version: ${secret_name}"
    printf '%s' "${value}" \
      | gcloud secrets versions add "${secret_name}" \
        --project="${PROJECT}" \
        --data-file=- >/dev/null
  fi
}

echo "==> Secret Manager 멱등 동기화"
if [[ "${AI_KEYS_ONLY}" -eq 1 ]]; then
  ensure_secret "${SECRET_MOABOM_OPENAI_API_KEY}"   "${MOABOM_OPENAI_API_KEY}"
  ensure_secret "${SECRET_MOABOM_ANTHROPIC_API_KEY}" "${MOABOM_ANTHROPIC_API_KEY}"
  ensure_secret "${SECRET_MOABOM_GOOGLE_AI_API_KEY}" "${MOABOM_GOOGLE_AI_API_KEY}"
elif [[ "${REVERB_ONLY}" -eq 1 ]]; then
  ensure_secret "${SECRET_REVERB_APP_SECRET}" "${REVERB_APP_SECRET_VAL}"
else
  ensure_secret "${SECRET_DB_PASSWORD}"   "${DB_PASSWORD}"
  ensure_secret "${SECRET_APP_KEY}"       "${APP_KEY_VAL}"
  ensure_secret "${SECRET_SOCIAL_NAVER}"  "${SOCIAL_NAVER_SECRET}"
  ensure_secret "${SECRET_SOCIAL_KAKAO}"  "${SOCIAL_KAKAO_SECRET}"
  ensure_secret "${SECRET_SOCIAL_GOOGLE}" "${SOCIAL_GOOGLE_SECRET}"
fi

# ── Cloud Run service account 에 secretAccessor 권한 ─────────────────────────
if [[ "${GRANT_IAM}" -eq 1 ]]; then
  echo "==> Cloud Run service account 권한 부여 (roles/secretmanager.secretAccessor)"
  SA_EMAIL="$(gcloud run services describe "${SERVICE}" \
    --region="${REGION}" --project="${PROJECT}" \
    --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
  if [[ -z "${SA_EMAIL}" ]]; then
    PROJECT_NUMBER="$(gcloud projects describe "${PROJECT}" --format='value(projectNumber)')"
    SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
    echo "    (서비스 SA 미지정 — 기본 compute SA 사용: ${SA_EMAIL})"
  fi

  for secret_name in \
    "${SECRET_DB_PASSWORD}" \
    "${SECRET_APP_KEY}" \
    "${SECRET_SOCIAL_NAVER}" \
    "${SECRET_SOCIAL_KAKAO}" \
    "${SECRET_SOCIAL_GOOGLE}" \
    "${SECRET_MOABOM_OPENAI_API_KEY}" \
    "${SECRET_MOABOM_ANTHROPIC_API_KEY}" \
    "${SECRET_MOABOM_GOOGLE_AI_API_KEY}" \
    "${SECRET_REVERB_APP_SECRET}" \
    "${SECRET_REALTIME_VM_METRICS_TOKEN}"
  do
    if [[ "${AI_KEYS_ONLY}" -eq 1 ]]; then
      case "${secret_name}" in
        "${SECRET_MOABOM_OPENAI_API_KEY}"|\
        "${SECRET_MOABOM_ANTHROPIC_API_KEY}"|\
        "${SECRET_MOABOM_GOOGLE_AI_API_KEY}") ;;
        *) continue ;;
      esac
    elif [[ "${REVERB_ONLY}" -eq 1 ]]; then
      [[ "${secret_name}" == "${SECRET_REVERB_APP_SECRET}" ]] || continue
    elif [[ "${secret_name}" == "${SECRET_MOABOM_OPENAI_API_KEY}" || \
            "${secret_name}" == "${SECRET_MOABOM_ANTHROPIC_API_KEY}" || \
            "${secret_name}" == "${SECRET_MOABOM_GOOGLE_AI_API_KEY}" ]]; then
      if ! gcloud secrets describe "${secret_name}" --project="${PROJECT}" >/dev/null 2>&1; then
        continue
      fi
    fi
    gcloud secrets add-iam-policy-binding "${secret_name}" \
      --project="${PROJECT}" \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="roles/secretmanager.secretAccessor" \
      --condition=None \
      --quiet >/dev/null 2>&1 || {
        echo "WARN: ${secret_name} IAM 바인딩 실패 (이미 부여되어 있거나 권한 부족)"
      }
  done
  echo "    OK (${SA_EMAIL})"
fi

# ── production.env.yaml 에서 시크릿 키 라인 제거 ────────────────────────────
if [[ "${STRIP_ENV}" -eq 1 ]]; then
  ENV_FILE="${ROOT}/deploy/production.env.yaml"
  if [[ -f "${ENV_FILE}" ]]; then
    cp -p "${ENV_FILE}" "${ENV_FILE}.bak"
    echo "==> ${ENV_FILE} 에서 시크릿 키 제거 (백업: ${ENV_FILE}.bak)"
    local_tmp="$(mktemp)"
    # moabom_gcp_secret_env_keys 가 출력하는 키들을 한 번에 sed 로 제거
    keys_pattern="$(moabom_gcp_secret_env_keys | paste -sd '|' -)"
    awk -v pattern="^(${keys_pattern}):" '$0 !~ pattern' "${ENV_FILE}" > "${local_tmp}"
    mv "${local_tmp}" "${ENV_FILE}"
    echo "    제거된 키 (Secret Manager 로 이동):"
    moabom_gcp_secret_env_keys | sed 's/^/      - /'
  fi
fi

echo ""
echo "==> Secret Manager 부트스트랩 완료. 다음 배포부터 자동 적용:"
echo "      bash deploy/build-and-deploy.sh --env-only   # env+secret 만 (~1분)"
echo "      bash deploy/build-and-deploy.sh              # 새 이미지 + env + secret"
