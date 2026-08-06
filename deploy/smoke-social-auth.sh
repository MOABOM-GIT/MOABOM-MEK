#!/usr/bin/env bash
# SNS OAuth 브로커·DB 설정 Phase 5 스모크 — 배포 전/후 정적·런타임 검증
# 사용: bash deploy/smoke-social-auth.sh
#       SMOKE_BASE_URL=https://mek360.com bash deploy/smoke-social-auth.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="${ROOT}/deploy/production.env.yaml"
ACTIVE_AUTH="${ROOT}/app/modules/moabom-social-auth"
ACTIVE_SYS="${ROOT}/app/modules/moabom-system"
BROKER_HOST="${MOABOM_SOCIAL_AUTH_BROKER_HOST:-auth.mek360.com}"
BASE_URL="${SMOKE_BASE_URL:-}"
FAIL=0

fail() { echo "ERROR: $*"; FAIL=1; }
warn() { echo "WARN:  $*"; }
ok()   { echo "    OK: $*"; }

echo "==> [sns-1] 활성 모듈·tenant seed SSOT"
[[ -f "${ACTIVE_AUTH}/src/Services/TenantSocialAuthDatabaseSeeder.php" ]] \
  || fail "TenantSocialAuthDatabaseSeeder 없음"
[[ -f "${ACTIVE_AUTH}/src/Services/SocialAuthTenantRuntimeSwitcher.php" ]] \
  || fail "SocialAuthTenantRuntimeSwitcher 없음"
grep -q 'oauth/{provider}/callback' "${ACTIVE_AUTH}/src/routes/api.php" \
  || fail "broker callback route 없음"
grep -q 'TenantSocialAuthDatabaseSeeder' "${ACTIVE_SYS}/src/Saas/TenantSocialAuthSettingsSeeder.php" \
  || fail "TenantSocialAuthSettingsSeeder 가 DB seeder 미위임"
grep -q 'Storage::disk' "${ACTIVE_SYS}/src/Saas/TenantSocialAuthSettingsSeeder.php" \
  && fail "TenantSocialAuthSettingsSeeder 에 GCS/modules Storage 잔존"
ok "moabom-social-auth + moabom-system tenant DB seed"

echo "==> [sns-2] production.env.yaml SNS·SaaS 필수값"
[[ -f "${ENV}" ]] || fail "production.env.yaml 없음"
grep -q 'MOABOM_SOCIAL_AUTH_BROKER_ENABLED: "true"' "${ENV}" \
  || fail "MOABOM_SOCIAL_AUTH_BROKER_ENABLED != true"
grep -q "MOABOM_SOCIAL_AUTH_BROKER_HOST: ${BROKER_HOST}" "${ENV}" \
  || grep -q "MOABOM_SOCIAL_AUTH_BROKER_HOST: auth.mek360.com" "${ENV}" \
  || fail "MOABOM_SOCIAL_AUTH_BROKER_HOST 누락/불일치"
grep -q 'auth.mek360.com' "${ENV}" \
  || fail "MOABOM_SAAS_PLATFORM_HOSTS 에 auth.mek360.com 없음"
# client_id 는 평문 env, client_secret 은 Secret Manager (gcp-env.sh#moabom_gcp_secret_mappings)
grep -q 'SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_ID:' "${ENV}" \
  || warn "SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_ID 없음 — seed-platform-master 수동/env 필요"
grep -q 'SOCIAL_AUTH_MASTER_KAKAO_CLIENT_ID:' "${ENV}" || warn "SOCIAL_AUTH_MASTER_KAKAO_CLIENT_ID 없음"
grep -q 'SOCIAL_AUTH_MASTER_NAVER_CLIENT_ID:' "${ENV}" || warn "SOCIAL_AUTH_MASTER_NAVER_CLIENT_ID 없음"
# Secret Manager 충돌 가드 — production.env.yaml 에 *_CLIENT_SECRET 평문 잔존 시 gcloud 충돌
if grep -qE '^SOCIAL_AUTH_MASTER_(NAVER|KAKAO|GOOGLE)_CLIENT_SECRET:' "${ENV}"; then
  fail "production.env.yaml 에 *_CLIENT_SECRET 평문 잔존 — Secret Manager 와 충돌 (deploy/secret-manager-bootstrap.sh)"
fi
ok "broker env + platform hosts (secrets → Secret Manager)"

# Secret Manager 매핑 SSOT 가드 — gcp-env.sh 에 시크릿 매핑이 정의되어야 함
GCP_ENV_LIB="${ROOT}/deploy/lib/gcp-env.sh"
[[ -f "${GCP_ENV_LIB}" ]] || fail "deploy/lib/gcp-env.sh 없음 (인프라 SSOT)"
grep -q 'SOCIAL_AUTH_MASTER_NAVER_CLIENT_SECRET=' "${GCP_ENV_LIB}" \
  || fail "gcp-env.sh#moabom_gcp_secret_mappings 에 NAVER_CLIENT_SECRET 매핑 없음"
grep -q 'SOCIAL_AUTH_MASTER_KAKAO_CLIENT_SECRET=' "${GCP_ENV_LIB}" \
  || fail "gcp-env.sh#moabom_gcp_secret_mappings 에 KAKAO_CLIENT_SECRET 매핑 없음"
grep -q 'SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_SECRET=' "${GCP_ENV_LIB}" \
  || fail "gcp-env.sh#moabom_gcp_secret_mappings 에 GOOGLE_CLIENT_SECRET 매핑 없음"
ok "Secret Manager 매핑 SSOT"

echo "==> [sns-3] Provider 콘솔 Redirect URI (수동 등록 확인용)"
for provider in google kakao naver; do
  echo "    ${provider}: https://${BROKER_HOST}/api/modules/moabom-social-auth/oauth/${provider}/callback"
done

echo "==> [sns-4] post-deploy platform seed hook"
grep -q 'moabom:social-auth:seed-platform-master' "${ROOT}/deploy/build-and-deploy.sh" \
  || fail "build-and-deploy.sh post-deploy seed-platform-master 없음"
if grep -q 'moabom:social-auth:seed-platform-master' "${ROOT}/deploy/cloudrun-entrypoint.sh"; then
  fail "cold start entrypoint 에 seed-platform-master 재유입 금지"
fi
ok "post-deploy platform master seed"

echo "==> [sns-5] moabom-basic popup OAuth (src + dist)"
DIST_JS="${ROOT}/app/templates/moabom-basic/dist/js/components.iife.js"
SRC_JS="${ROOT}/app/templates/moabom-basic/src/utils/socialAuth.ts"
[[ -f "${SRC_JS}" ]] || fail "socialAuth.ts 없음"
grep -q 'moabom-social-auth-' "${SRC_JS}" \
  || fail "socialAuth.ts 에 popup window name prefix 없음"
grep -q 'popup=yes' "${SRC_JS}" || fail "socialAuth.ts 에 popup=yes features 없음"
if grep -q 'noopener=yes' "${SRC_JS}" 2>/dev/null; then
  fail "socialAuth.ts 에 noopener=yes 잔존 — popup postMessage 실패"
fi
ok "socialAuth.ts popup SSOT"

if [[ -f "${DIST_JS}" ]]; then
  if grep -q 'popup=yes,noopener=yes,noreferrer=yes' "${DIST_JS}" 2>/dev/null; then
    fail "dist JS 가 구 popup 구현 — Cloud Build asset stage 산출물 갱신 필요"
  elif ! grep -q 'moabom-social-auth-' "${DIST_JS}" 2>/dev/null; then
    fail "dist JS 에 moabom-social-auth- prefix 없음 — Cloud Build asset stage 산출물 갱신 필요"
  else
    ok "dist popup socialAuth 번들"
  fi
else
  warn "dist/js/components.iife.js 없음 — Cloud Build 산출 후 재검증"
fi

if docker compose -f "${ROOT}/docker-compose.yml" ps --status running app 2>/dev/null | grep -q app; then
  echo "==> [sns-6] 로컬 runtime (docker app)"
  LOCAL_URL="${BASE_URL:-http://localhost:8080}"

  if ./scripts/g7 php artisan list 2>/dev/null | grep -q 'moabom:social-auth:seed-platform-master'; then
    ok "artisan moabom:social-auth:seed-platform-master 등록"
  else
    warn "seed-platform-master command 미등록 — module:update moabom-social-auth 후 재검증"
  fi

  if ./scripts/g7 php artisan list 2>/dev/null | grep -q 'moabom:saas:tenant-sync-social-auth'; then
    ok "artisan moabom:saas:tenant-sync-social-auth 등록"
  else
    warn "tenant-sync-social-auth command 미등록 — module:update moabom-system 후 재검증"
  fi

  if command -v curl >/dev/null 2>&1; then
    code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/json' \
      "${LOCAL_URL}/api/modules/moabom-social-auth/providers" 2>/dev/null || echo '000')"
    if [[ "${code}" == "200" ]]; then
      ok "GET /providers → HTTP 200"
    else
      warn "GET /providers → HTTP ${code} (enabled provider 없거나 모듈 미활성)"
    fi
  fi

  if ./scripts/g7 php artisan migrate:status --path=modules/moabom-social-auth/database/migrations 2>/dev/null \
    | grep -q '2026_06_01_000004_create_social_auth_settings_table'; then
    if ./scripts/g7 php artisan migrate:status --path=modules/moabom-social-auth/database/migrations 2>/dev/null \
      | grep '2026_06_01_000004_create_social_auth_settings_table' | grep -q 'Pending'; then
      warn "social_auth_settings migration Pending — migrate 실행 필요"
    else
      ok "social_auth_settings migration applied"
    fi
  fi
else
  echo "==> [sns-6] 로컬 runtime — docker app 미실행 (정적 검증만)"
fi

if [[ -n "${BASE_URL}" ]] && [[ "${BASE_URL}" != "http://localhost:8080" ]]; then
  echo "==> [sns-7] 운영 URL probe (${BASE_URL})"
  if command -v curl >/dev/null 2>&1; then
    auth_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
      "https://${BROKER_HOST}/api/modules/moabom-social-auth/providers" 2>/dev/null || echo '000')"
    if [[ "${auth_code}" =~ ^(200|302|401|403)$ ]]; then
      ok "auth host ${BROKER_HOST} reachable (HTTP ${auth_code})"
    else
      warn "auth host ${BROKER_HOST} HTTP ${auth_code} — DNS/LB/Cloud Run 라우팅 확인"
    fi
  fi
fi

echo ""
echo "==> Phase 5 수동 체크리스트 (운영)"
echo "    [ ] Google Cloud Console → OAuth Redirect URI 등록"
echo "    [ ] Kakao Developers → Redirect URI 등록"
echo "    [ ] Naver Developers → Callback URL 등록"
echo "    [ ] tenant A/B 동일 SNS 계정 → 별도 member (별도 DB)"
echo "    [ ] Admin enabled → 웹 popup SNS 로그인 E2E"

if [[ "${FAIL}" -ne 0 ]]; then
  echo ""
  echo "==> SNS smoke 실패 — moabom-social-auth/docs/ADMIN-HOST-SCOPE.md · DEPLOY-RECURRING-FAILURES.md 참고"
  exit 1
fi

echo "==> SNS smoke 통과 (정적 + 가용 runtime)"
