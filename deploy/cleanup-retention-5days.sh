#!/usr/bin/env bash
# Moabom 5일 보관 정책 정리 — 운영 SSOT·현재 revision·최근 이미지 보호.
# Usage: bash deploy/cleanup-retention-5days.sh [--dry-run]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=deploy/lib/gcp-env.sh
source "${ROOT}/deploy/lib/gcp-env.sh"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

PROJECT="$(moabom_gcp_project)"
REGION="$(moabom_gcp_region)"
SERVICE="$(moabom_gcp_cloud_run_service)"
REPO="$(moabom_gcp_artifact_repo)"
BUCKET="$(moabom_gcp_gcs_bucket)"
IMAGE_URI="asia-northeast3-docker.pkg.dev/${PROJECT}/${REPO}/mobaom-container"

# 5일 전 00:00 UTC (오늘 2026-06-30 기준 → 2026-06-25)
CUTOFF_DATE="${MOABOM_RETENTION_CUTOFF_DATE:-2026-06-25}"
CUTOFF="${CUTOFF_DATE}T00:00:00Z"

log() { printf '[cleanup] %s\n' "$*"; }
run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: $*"
  else
    log "RUN: $*"
    eval "$@"
  fi
}

log "=== Moabom 5-day retention cleanup (cutoff=${CUTOFF}) dry_run=${DRY_RUN} ==="

# ── 1. 로컬 WSL 누적물 ─────────────────────────────────────────────────────
for archive in "${ROOT}"/_archive_*; do
  [[ -d "$archive" ]] || continue
  run "rm -rf $(printf '%q' "$archive")"
done

for fw in cache sessions views; do
  dir="${ROOT}/app/storage/framework/${fw}"
  if [[ -d "$dir" ]]; then
    run "find $(printf '%q' "$dir") -mindepth 1 ! -name '.gitignore' -delete 2>/dev/null || true"
  fi
done

# 5일 초과 로그 (repo 루트·deploy)
while IFS= read -r -d '' f; do
  run "rm -f $(printf '%q' "$f")"
done < <(find "${ROOT}" -maxdepth 2 -name '*.log' -mtime +5 -print0 2>/dev/null)

# ── 2. GCS 백업 prefix (운영 tenants/settings/attachments 제외) ─────────────
while IFS= read -r obj; do
  [[ -n "$obj" ]] || continue
  ts="$(gsutil ls -l "$obj" 2>/dev/null | awk 'NR==1{print $2}')"
  if [[ -n "$ts" && "$ts" < "$CUTOFF" ]]; then
    run "gsutil -m rm -r $(printf '%q' "$obj")"
  fi
done < <(gsutil ls "gs://${BUCKET}/backups/**" 2>/dev/null || true)

while IFS= read -r prefix; do
  [[ -n "$prefix" ]] || continue
  folder_date="$(basename "${prefix%/}")"
  if [[ "$folder_date" =~ ^[0-9]{8}$ ]] && [[ "$folder_date" < "$(echo "$CUTOFF_DATE" | tr -d '-')" ]]; then
    run "gsutil -m rm -r $(printf '%q' "$prefix")"
  fi
done < <(gsutil ls -d "gs://${BUCKET}/sql-migration/*/" 2>/dev/null || true)

# ── 3. Artifact Registry — 5일 초과 이미지 digest ───────────────────────────
CURRENT_DIGEST="$(
  gcloud run services describe "$SERVICE" \
    --region="$REGION" --project="$PROJECT" \
    --format='value(spec.template.spec.containers[0].image)' 2>/dev/null \
    | sed -n 's/.*@\(sha256:[a-f0-9]*\).*/\1/p'
)"
CURRENT_TAG="$(
  gcloud run services describe "$SERVICE" \
    --region="$REGION" --project="$PROJECT" \
    --format='value(spec.template.spec.containers[0].image)' 2>/dev/null \
    | sed -n 's/.*:\(v[0-9]*\)$/\1/p'
)"
log "Protected Cloud Run image tag=${CURRENT_TAG} digest=${CURRENT_DIGEST:-n/a}"

mapfile -t OLD_DIGESTS < <(
  gcloud artifacts docker images list "$IMAGE_URI" \
    --project="$PROJECT" \
    --include-tags \
    --filter="createTime<\"${CUTOFF}\"" \
    --format='value(version)' 2>/dev/null || true
)

TO_DELETE_DIGESTS=()
for digest in "${OLD_DIGESTS[@]}"; do
  [[ -n "$digest" ]] || continue
  if [[ -n "$CURRENT_DIGEST" && "$digest" == "$CURRENT_DIGEST" ]]; then
    log "SKIP protected digest $digest"
    continue
  fi
  TO_DELETE_DIGESTS+=("$digest")
done

if ((${#TO_DELETE_DIGESTS[@]} > 0)); then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    for digest in "${TO_DELETE_DIGESTS[@]}"; do
      log "DRY-RUN: gcloud artifacts docker images delete '${IMAGE_URI}@${digest}' ..."
    done
  else
    log "Deleting ${#TO_DELETE_DIGESTS[@]} artifact image digests (parallel)"
    printf '%s\n' "${TO_DELETE_DIGESTS[@]}" \
      | xargs -r -P 8 -I{} gcloud artifacts docker images delete \
          "${IMAGE_URI}@{}" --project="${PROJECT}" --quiet --delete-tags
  fi
fi

# ── 4. Cloud Run — 비활성 revision (5일 초과) ─────────────────────────────
ACTIVE_REV="$(
  gcloud run services describe "$SERVICE" \
    --region="$REGION" --project="$PROJECT" \
    --format='value(status.traffic[0].revisionName)' 2>/dev/null
)"

mapfile -t OLD_REVS < <(
  gcloud run revisions list \
    --service="$SERVICE" --region="$REGION" --project="$PROJECT" \
    --format='value(name,creationTimestamp)' 2>/dev/null \
    | awk -v c="$CUTOFF" '$2 < c {print $1}' || true
)

if ((${#OLD_REVS[@]} > 0)); then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    for rev in "${OLD_REVS[@]}"; do
      [[ "$rev" == "$ACTIVE_REV" ]] && continue
      log "DRY-RUN: gcloud run revisions delete '${rev}' ..."
    done
  else
    log "Deleting ${#OLD_REVS[@]} old Cloud Run revisions (rate-limited)"
    printf '%s\n' "${OLD_REVS[@]}" \
      | awk -v active="$ACTIVE_REV" '$0 != active' \
      | while IFS= read -r rev; do
          gcloud run revisions delete "$rev" \
            --region="${REGION}" --project="${PROJECT}" --quiet \
            || sleep 15
          sleep 2
        done
  fi
fi

# ── 5. Cloud Build 이력 — GCP는 빌드 메타데이터 개별 삭제 API 미제공 ─────
# 로그·메타는 Cloud Logging retention 으로 관리. 여기서는 5일 초과 목록만 기록.
mapfile -t OLD_BUILDS < <(
  gcloud builds list \
    --project="$PROJECT" \
    --filter="createTime<\"${CUTOFF}\"" \
    --format='value(id)' 2>/dev/null || true
)
if ((${#OLD_BUILDS[@]} > 0)); then
  log "NOTE: ${#OLD_BUILDS[@]} Cloud Build records older than cutoff (console/API bulk delete unavailable via gcloud builds delete)"
fi

# ── 6. Realtime VM — 미사용 Docker 이미지·빌드 캐시 (볼륨·실행 컨테이너 유지) ─
if ssh -o BatchMode=yes -o ConnectTimeout=10 moabom-realtime-prod 'true' 2>/dev/null; then
  run "ssh -o BatchMode=yes moabom-realtime-prod 'sudo docker system prune -af --filter \"until=120h\" 2>/dev/null; sudo docker builder prune -af --filter \"until=120h\" 2>/dev/null; true'"
else
  log "SKIP VM: SSH moabom-realtime-prod unavailable"
fi

log "=== cleanup complete ==="
