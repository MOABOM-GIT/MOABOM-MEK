#!/usr/bin/env bash
# SSOT — Google Cloud 인프라 식별자 (project / region / Cloud Run / Cloud SQL /
# Artifact Registry / GCS / Secret Manager).
#
# 모든 deploy/*.sh, deploy/lib/*.sh 는 hardcoded fallback 금지 — 이 파일을 source 하고
# moabom_gcp_* 함수만 사용한다. 환경변수가 설정되어 있으면 그 값을 우선 사용 (CI/dev).
#
# Usage:
#   source "${ROOT}/deploy/lib/gcp-env.sh"
#   project="$(moabom_gcp_project)"
#   sql="$(moabom_gcp_cloudsql_instance)"
#   secrets="$(moabom_gcp_secret_mappings)"  # gcloud --set-secrets CSV
set -euo pipefail

# ── 기본값 (override: 동일 이름의 환경변수 export) ───────────────────────────
: "${GCP_PROJECT_ID:=smartmek}"
: "${GCP_REGION:=asia-northeast3}"
: "${GCP_ARTIFACT_REGION:=${GCP_REGION}}"
: "${GCP_ARTIFACT_REPO:=moabom-dock}"
: "${CLOUD_RUN_SERVICE:=mobaom-container}"
: "${CLOUDSQL_INSTANCE:=${GCP_PROJECT_ID}:${GCP_REGION}:moabom-sql}"
: "${GCS_BUCKET:=${GCP_PROJECT_ID}}"

# Secret Manager 시크릿 이름 (Cloud Run 의 env 키 ← Secret Manager 시크릿 매핑)
: "${SECRET_DB_PASSWORD:=moabom-db-password}"
: "${SECRET_APP_KEY:=moabom-app-key}"
: "${SECRET_SOCIAL_NAVER:=moabom-social-master-naver-secret}"
: "${SECRET_SOCIAL_KAKAO:=moabom-social-master-kakao-secret}"
: "${SECRET_SOCIAL_GOOGLE:=moabom-social-master-google-secret}"

moabom_gcp_project()             { echo "${GCP_PROJECT_ID}"; }
moabom_gcp_region()              { echo "${GCP_REGION}"; }
moabom_gcp_artifact_region()     { echo "${GCP_ARTIFACT_REGION}"; }
moabom_gcp_artifact_repo()       { echo "${GCP_ARTIFACT_REPO}"; }
moabom_gcp_cloud_run_service()   { echo "${CLOUD_RUN_SERVICE}"; }
moabom_gcp_cloudsql_instance()   { echo "${CLOUDSQL_INSTANCE}"; }
moabom_gcp_gcs_bucket()          { echo "${GCS_BUCKET}"; }

# gcloud run deploy / jobs (create|update) 에 그대로 넘길 수 있는 --set-secrets CSV.
# 각 항목: ENV_KEY=SECRET_NAME:latest
# DB_WRITE_PASSWORD / DB_READ_PASSWORD 는 동일 패스워드를 공유 (DB 운영자 분리 전).
moabom_gcp_secret_mappings() {
  local mappings=(
    "DB_WRITE_PASSWORD=${SECRET_DB_PASSWORD}:latest"
    "DB_READ_PASSWORD=${SECRET_DB_PASSWORD}:latest"
    "APP_KEY=${SECRET_APP_KEY}:latest"
    "SOCIAL_AUTH_MASTER_NAVER_CLIENT_SECRET=${SECRET_SOCIAL_NAVER}:latest"
    "SOCIAL_AUTH_MASTER_KAKAO_CLIENT_SECRET=${SECRET_SOCIAL_KAKAO}:latest"
    "SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_SECRET=${SECRET_SOCIAL_GOOGLE}:latest"
  )
  local IFS=,
  echo "${mappings[*]}"
}

# Secret Manager 로 옮긴 env 키 목록 (production.env.yaml 가드용).
# 이 키들이 production.env.yaml 에 평문으로 남아있으면 안 됨 — gcloud 가 충돌 에러.
moabom_gcp_secret_env_keys() {
  cat <<'EOF'
DB_WRITE_PASSWORD
DB_READ_PASSWORD
APP_KEY
SOCIAL_AUTH_MASTER_NAVER_CLIENT_SECRET
SOCIAL_AUTH_MASTER_KAKAO_CLIENT_SECRET
SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_SECRET
EOF
}

# Artifact Registry 컨테이너 이미지 host/repo prefix (태그 제외)
# 예) asia-northeast3-docker.pkg.dev/smartmek/moabom-dock
moabom_gcp_image_repo() {
  echo "$(moabom_gcp_artifact_region)-docker.pkg.dev/$(moabom_gcp_project)/$(moabom_gcp_artifact_repo)"
}
