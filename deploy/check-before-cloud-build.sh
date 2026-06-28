#!/usr/bin/env bash
# v7 성공 배포 기준 검증 — 로컬·Cloud Build 1단계 공통
# deploy/README.md · DEPLOY-RECURRING-FAILURES.md 참고
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CB="${ROOT}/deploy/cloudbuild-v3.yaml"
ENV="${ROOT}/deploy/production.env.yaml"
DOCKERFILE="${ROOT}/deploy/Dockerfile"
MRP="${ROOT}/app/app/Providers/ModuleRouteServiceProvider.php"
ACTIVE_SYS="${ROOT}/app/modules/moabom-system"
GCLOUDIGNORE="${ROOT}/.gcloudignore"
DIST_JS="${ROOT}/app/templates/moabom-basic/dist/js/components.iife.js"

cd "${ROOT}"
FAIL=0

fail() { echo "ERROR: $*"; FAIL=1; }
warn() { echo "WARN:  $*"; }
ok()   { echo "    OK: $*"; }

echo "==> [v7-1] cloudbuild 단일 태그"
TAG="${IMAGE_TAG:-$(grep -E '^  _IMAGE_TAG:' "${CB}" 2>/dev/null | awk '{print $2}')}"
[[ -n "${TAG}" ]] || fail "substitutions._IMAGE_TAG 없음"
grep -qF 'mobaom-container:${_IMAGE_TAG}' "${CB}" || fail "mobaom-container:\${_IMAGE_TAG} 참조 없음"
ok "mobaom-container:${TAG}"

echo "==> [v7-1b] moabom-system config SSOT (saas → config/moabom-saas.php)"
SSOT_CFG="${ROOT}/deploy/ssot/moabom-system.config.php"
[[ -f "${ROOT}/app/config/moabom-saas.php" ]] || fail "app/config/moabom-saas.php 없음"
grep -q "MOABOM_SAAS_ENABLED" "${ROOT}/app/config/moabom-saas.php" \
  || fail "moabom-saas.php 에 MOABOM_SAAS_ENABLED SSOT 없음"
[[ -f "${SSOT_CFG}" ]] || fail "deploy/ssot/moabom-system.config.php 없음"
if cp "${SSOT_CFG}" "${ACTIVE_SYS}/config/moabom-system.php" 2>/dev/null; then
  ok "moabom-system.config.php ← deploy/ssot"
elif docker compose -f "${ROOT}/docker-compose.yml" ps --status running app 2>/dev/null | grep -q app; then
  docker compose -f "${ROOT}/docker-compose.yml" cp "${SSOT_CFG}" "app:/var/www/html/modules/moabom-system/config/moabom-system.php"
  ok "moabom-system.config.php ← deploy/ssot (docker cp)"
else
  fail "moabom-system.config.php 복사 실패 (권한 또는 docker app 미실행)"
fi

echo "==> [v7-2] moabom-system 활성 경로 (404 방지)"
[[ -f "${ACTIVE_SYS}/src/Http/Controllers/PublicShellBootController.php" ]] \
  || fail "활성 modules/moabom-system 에 PublicShellBootController.php 없음 (SSOT 누락)"
grep -q 'public/shell-boot' "${ACTIVE_SYS}/src/routes/api.php" 2>/dev/null \
  || fail "활성 api.php 에 public/shell-boot 없음"
grep -q 'public/ready' "${ACTIVE_SYS}/src/routes/api.php" 2>/dev/null \
  || fail "활성 api.php 에 public/ready 없음 (Cloud Run startup probe)"
ok "shell-boot + ready @ modules/moabom-system"

echo "==> [v7-2b] GCS 첨부파일 DI (아바타 500 방지)"
REGISTRAR="${ACTIVE_SYS}/src/Support/MoabomGcsAttachmentRegistrar.php"
PROVIDER="${ACTIVE_SYS}/src/Providers/SystemServiceProvider.php"
[[ -f "${REGISTRAR}" ]] || fail "활성 modules/moabom-system 에 MoabomGcsAttachmentRegistrar.php 없음"
grep -q 'MoabomGcsAttachmentRegistrar::register' "${PROVIDER}" \
  || fail "SystemServiceProvider 에 Registrar::register 없음"
grep -q 'new MoabomGcsAttachmentService' "${REGISTRAR}" \
  || fail "Registrar 에 factory(new MoabomGcsAttachmentService) 없음 — when(StorageInterface) 만 쓰면 v12형 500"
grep -q 'when(MoabomGcsAttachmentService' "${PROVIDER}" 2>/dev/null \
  && fail "when(MoabomGcsAttachmentService) 만 있으면 Cloud Run DI 실패 — Registrar factory 사용"
ok "GCS attachment factory bind"

echo "==> [v7-2c] extension autoload (moabom-credit 등 500 방지)"
chmod +x "${ROOT}/scripts/check-extension-autoload.sh" 2>/dev/null || true
if ! "${ROOT}/scripts/check-extension-autoload.sh"; then
  fail "extension autoload 불일치 — scripts/check-extension-autoload.sh"
fi

echo "==> [v7-2d] moabom-chat 프로필·채팅 API SSOT (blocks/eligibility 404 방지)"
chmod +x "${ROOT}/scripts/check-moabom-chat-api-ssot.sh" 2>/dev/null || true
if ! "${ROOT}/scripts/check-moabom-chat-api-ssot.sh"; then
  fail "moabom-chat API SSOT 불일치 — scripts/check-moabom-chat-api-ssot.sh"
fi

echo "==> [v7-3] ModuleRouteServiceProvider (500 방지)"
grep -q 'ModuleManager::getActiveModuleIdentifiers' "${MRP}" \
  || fail "ModuleManager::getActiveModuleIdentifiers() 필요"
grep -q 'ExtensionManager::getActiveModuleIdentifiers' "${MRP}" \
  && fail "ExtensionManager::getActiveModuleIdentifiers() 금지 (v6 500 원인)"
grep -q 'ExtensionManager::directoryToNamespace' "${MRP}" \
  || fail "ExtensionManager::directoryToNamespace() 필요 (import 누락 시 500)"
grep -q 'use App\\Extension\\ExtensionManager' "${MRP}" \
  || fail "use ExtensionManager import 필요"
ok "ModuleManager + ExtensionManager::directoryToNamespace"

echo "==> [v7-4] Dockerfile 에서 활성 템플릿/모듈/플러그인을 모두 빌드 (Cloud Build SSOT)"
# 사용자 정책: 호스트/WSL 빌드 금지, 모든 빌드는 Cloud Build 안에서.
# module.json/plugin.json 에 assets 가 선언된 활성 확장은 Dockerfile assets 단계에 npm ci+build+dist COPY 가 있어야 한다.
CLOUD_BUILD_ASSET_PATHS=(
  'templates/moabom-admin_basic'
  'templates/moabom-basic'
  'modules/sirsoft-ecommerce'
  'plugins/sirsoft-ckeditor5'
  'plugins/sirsoft-daum_postcode'
  'plugins/sirsoft-tosspayments'
  'plugins/moabom-auth-hardening'
)
for asset_path in "${CLOUD_BUILD_ASSET_PATHS[@]}"; do
  grep -qE "${asset_path}.*npm (ci|run build)" "${DOCKERFILE}" 2>/dev/null \
    || fail "Dockerfile 에 ${asset_path} npm 빌드 단계 누락 — Cloud Build 가 dist 를 못 만들면 운영 미반영"
  grep -qE "COPY --from=assets .*${asset_path}/dist ./${asset_path}/dist" "${DOCKERFILE}" 2>/dev/null \
    || fail "Dockerfile 에 ${asset_path} dist COPY 누락 — moduleAssets/pluginAssets 가 런타임에서 404"
done
ok "Dockerfile 이 assets 선언 확장 dist 를 모두 빌드·복사 (템플릿 2·모듈 1·플러그인 4)"

echo "==> [v7-4b] Dockerfile 에 _bundled COPY 금지 (활성 폴더 SSOT)"
if grep -nE '^COPY[[:space:]].*_bundled' "${DOCKERFILE}" 2>/dev/null; then
  fail "Dockerfile 이 _bundled 를 COPY — 활성 modules/templates 만 패키징 원칙 위반"
fi
ok "Dockerfile COPY 에 _bundled 없음"

echo "==> [v7-9] 로컬 빌드 차단 가드 (Cloud Build 전용)"
if ! grep -q 'MOABOM_BUILD_ENV' "${DOCKERFILE}" 2>/dev/null; then
  fail "deploy/Dockerfile 에 MOABOM_BUILD_ENV 가드 없음 — 로컬 docker build 차단 불가"
fi
if ! grep -q 'MOABOM_LOCAL_BUILD_ACK' "${DOCKERFILE}" 2>/dev/null; then
  fail "deploy/Dockerfile 에 MOABOM_LOCAL_BUILD_ACK 가드 없음"
fi
if ! grep -qE 'if \[ "\$MOABOM_BUILD_ENV" != "cloudbuild" \]' "${DOCKERFILE}" 2>/dev/null; then
  fail "deploy/Dockerfile 의 가드 RUN 이 cloudbuild 비교 형태와 다름"
fi
if ! grep -q 'MOABOM_BUILD_ENV=cloudbuild' "${CB}" 2>/dev/null; then
  fail "deploy/cloudbuild-v3.yaml docker build 에 --build-arg MOABOM_BUILD_ENV=cloudbuild 누락 — 정상 빌드도 차단됨"
fi
grep -q 'MOABOM_BUILD_ENV=cloudbuild npm run build' "${DOCKERFILE}" 2>/dev/null \
  || fail "deploy/Dockerfile asset build 가 MOABOM_BUILD_ENV=cloudbuild 로 npm build 를 실행하지 않음"
ok "로컬 빌드 차단 가드 + cloudbuild build-arg"

echo "==> [v7-5b] Cloud Run Billing SSOT (Request-based 고정)"
chmod +x "${ROOT}/deploy/check-cloud-run-billing-ssot.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/check-cloud-run-billing-ssot.sh"; then
  fail "Cloud Run billing SSOT — deploy/check-cloud-run-billing-ssot.sh"
fi

echo "==> [v7-5] production.env.yaml (v7 운영 스펙)"
[[ -f "${ENV}" ]] || fail "production.env.yaml 없음"
grep -q 'DB_SOCKET:' "${ENV}" || fail "DB_SOCKET 없음 (compose DB_HOST=db 금지)"
grep -q 'SESSION_DRIVER: cookie' "${ENV}" || fail "SESSION_DRIVER: cookie 필요"
grep -q 'G7_JSON_SETTINGS_CACHE_TTL:' "${ENV}" || fail "G7_JSON_SETTINGS_CACHE_TTL 없음"
grep -qE 'DB_WRITE_HOST: db$' "${ENV}" && fail "DB_WRITE_HOST: db 는 Cloud Run 에서 실패"
grep -q '^LOG_LEVEL: debug$' "${ENV}" && fail "운영 LOG_LEVEL=debug 금지 — 장애 조사 시 env-only 로만 임시 적용"
grep -q '^QUEUE_CONNECTION: database$' "${ENV}" || fail "QUEUE_CONNECTION: database 필요"
grep -q '^DB_QUEUE_RETRY_AFTER: "120"$' "${ENV}" || fail "DB_QUEUE_RETRY_AFTER: \"120\" 필요 (queue worker timeout 보다 커야 함)"
grep -q '^BROADCAST_CONNECTION: reverb$' "${ENV}" || fail "BROADCAST_CONNECTION: reverb 필요"
grep -q '^REVERB_HOST: realtime\.mek360\.com$' "${ENV}" || fail "REVERB_HOST 는 realtime.mek360.com 이어야 함"
grep -q '^REVERB_PORT: "443"$' "${ENV}" || fail "REVERB_PORT: \"443\" 필요"
grep -q '^REVERB_SCHEME: https$' "${ENV}" || fail "REVERB_SCHEME: https 필요"
grep -q '^REVERB_SERVER_HOST: realtime\.mek360\.com$' "${ENV}" || fail "REVERB_SERVER_HOST 는 realtime.mek360.com 이어야 함"
grep -q '^REVERB_SERVER_PORT: "443"$' "${ENV}" || fail "REVERB_SERVER_PORT: \"443\" 필요"
grep -q '^REVERB_SERVER_SCHEME: https$' "${ENV}" || fail "REVERB_SERVER_SCHEME: https 필요"
grep -q 'reverb:start' "${ROOT}/deploy/supervisord.conf" \
  && fail "Cloud Run supervisord 에 reverb:start sidecar 잔존 — Realtime VM SSOT"
grep -q 'proxy_pass http://127\.0\.0\.1:6001' "${ROOT}/deploy/nginx-cloudrun.conf" \
  && fail "Cloud Run nginx 가 로컬 Reverb(127.0.0.1:6001)에 의존"
grep -q -- '--timeout=60' "${ROOT}/deploy/supervisord.conf" \
  || fail "queue-worker timeout 가드 누락"
grep -q -- '--max-jobs=500' "${ROOT}/deploy/supervisord.conf" \
  || fail "queue-worker max-jobs 가드 누락"
grep -q -- '--memory=192' "${ROOT}/deploy/supervisord.conf" \
  || fail "queue-worker memory 가드 누락"
grep -q 'MoabomRuntimeDriverSettings::normalize' "${ROOT}/app/modules/moabom-system/src/Saas/MoabomDbConfigRepository.php" \
  || fail "관리자 drivers 설정이 운영 runtime driver 와 정규화되지 않음"
grep -q 'available_session_drivers' "${ROOT}/app/modules/moabom-system/src/Providers/SystemServiceProvider.php" \
  || fail "관리자 session driver 옵션 확장(cookie) 누락"
grep -q 'available_log_drivers' "${ROOT}/app/modules/moabom-system/src/Providers/SystemServiceProvider.php" \
  || fail "관리자 log driver 옵션 확장(stderr) 누락"
grep -q 'SaasNormalizeDriverSettingsCommand::class' "${ROOT}/app/modules/moabom-system/src/Providers/SystemServiceProvider.php" \
  || fail "drivers DB/GCS 1회 정규화 커맨드 등록 누락"
grep -q 'drivers_runtime_lock_notice' "${ROOT}/app/templates/moabom-admin_basic/layouts/partials/admin_settings/_tab_drivers.json" \
  || fail "관리자 drivers 운영 고정값 안내 UI 누락"
# Secret Manager SSOT — 시크릿 키가 production.env.yaml 에 평문 잔존하면 gcloud --set-secrets 와 충돌
if [[ -f "${ROOT}/deploy/lib/gcp-env.sh" ]]; then
  # shellcheck source=lib/gcp-env.sh
  source "${ROOT}/deploy/lib/gcp-env.sh"
  while IFS= read -r secret_key; do
    [[ -z "${secret_key}" ]] && continue
    if grep -qE "^${secret_key}: " "${ENV}"; then
      fail "${secret_key} 가 production.env.yaml 에 평문 잔존 — Secret Manager 와 충돌 (bash deploy/secret-manager-bootstrap.sh)"
    fi
  done < <(moabom_gcp_secret_env_keys)
fi
ok "DB_SOCKET, SESSION cookie, settings TTL, queue/log, Reverb VM env/sidecar, Secret Manager 충돌 없음"

echo "==> [v7-6] .gcloudignore (업로드 병목)"
[[ -f "${GCLOUDIGNORE}" ]] || fail ".gcloudignore 없음"
grep -q 'node_modules' "${GCLOUDIGNORE}" || fail "**/node_modules 제외 없음"
grep -q '_bundled' "${GCLOUDIGNORE}" || fail "app/*/_bundled 제외 없음"
grep -q '\*\*/dist/' "${GCLOUDIGNORE}" || fail "**/dist 제외 없음 (Cloud Build asset stage 산출물 SSOT)"
grep -q '\*\*/dist' "${ROOT}/.dockerignore" || fail ".dockerignore **/dist 제외 없음"
ok "node_modules + _bundled + 로컬 dist 업로드 제외"

echo "==> [v7-6b] TS 경계 (upstream tsconfig 허용 + 활성 템플릿 SSOT)"
TSCONFIG="${ROOT}/app/tsconfig.json"
MOABOM_TSC="${ROOT}/app/templates/moabom-basic/tsconfig.json"
[[ -f "${TSCONFIG}" ]] || fail "app/tsconfig.json 없음"
[[ -f "${MOABOM_TSC}" ]] || fail "templates/moabom-basic/tsconfig.json 없음 — Cloud Build SSOT"
ok "tsconfig: g7 코어 + moabom-basic 전용 tsconfig"

echo "==> [v7-6bb] Moabom 반응형 breakpoint SSOT"
chmod +x "${ROOT}/scripts/check-responsive-breakpoints.sh" 2>/dev/null || true
if ! "${ROOT}/scripts/check-responsive-breakpoints.sh"; then
  fail "responsive breakpoint 불일치 — scripts/check-responsive-breakpoints.sh"
fi

echo "==> [v7-6c] Moabom 최소 코어 패치 (core:update 전 게이트)"
chmod +x "${ROOT}/deploy/check-core-patches.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/check-core-patches.sh"; then
  fail "코어 패치 정합성 — deploy/check-core-patches.sh"
fi

echo "==> [v7-6d] G7 코어 가드 주입 (upstream PR 후보)"
chmod +x "${ROOT}/deploy/check-g7-core-guard-regression.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/check-g7-core-guard-regression.sh"; then
  fail "코어 가드 회귀 — deploy/check-g7-core-guard-regression.sh"
fi

echo "==> [v7-6e] 활성 경로 _bundled 참조 금지"
chmod +x "${ROOT}/deploy/check-bundled-detach-regression.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/check-bundled-detach-regression.sh"; then
  fail "_bundled 의존 회귀 — deploy/check-bundled-detach-regression.sh"
fi

echo "==> [v7-7] moabom-basic dist (참고용 — 실제 dist 는 Cloud Build 가 매번 새로 만든다)"
# Cloud Build 가 templates/moabom-basic 을 빌드하므로 로컬 dist 잔존 여부는 운영에 영향 없음.
# 이 단계는 src/ 가 정상적인지 가벼운 sanity 만 본다.
[[ -d "${ROOT}/app/templates/moabom-basic/src" ]] \
  || fail "templates/moabom-basic/src 없음 — Cloud Build 가 빌드할 소스가 없다"
if [[ -f "${DIST_JS}" ]]; then
  echo "    info: repo 에 캐시된 dist 발견 ($(wc -c <"${DIST_JS}") bytes) — Cloud Build 가 덮어쓴다"
fi
ok "moabom-basic src 존재 (Cloud Build 빌드 대상)"

echo "==> [v7-7b] 번들 예산 가드 (Cloud Build 산출 hard gate)"
chmod +x "${ROOT}/deploy/check-bundle-budget.sh" 2>/dev/null || true
grep -q "COPY deploy/check-bundle-budget.sh" "${ROOT}/deploy/Dockerfile" \
  && grep -q "MOABOM_APP_ROOT=/app bash deploy/check-bundle-budget.sh" "${ROOT}/deploy/Dockerfile" \
  || fail "Dockerfile assets stage 에 번들 예산 hard gate 누락"
if [[ -f "${DIST_JS}" ]]; then
  if ! "${ROOT}/deploy/check-bundle-budget.sh" 2>&1 | sed 's/^/    /'; then
    echo "    info: repo 캐시 dist 가 예산 초과 — Cloud Build 산출이 동일 기준 통과해야 함"
  fi
else
  echo "    info: repo dist 없음 — Cloud Build 산출 후 동일 검사가 이미지 빌드 단계에서 적용됨"
fi
ok "번들 예산 hard gate 연결 (실제 검사는 Cloud Build 산출 기준)"

echo "==> [v7-8] 업로드 추정 (삭제 없음, .gcloudignore 반영)"
PRUNE='\( -path ./.git -o -path "*/node_modules" -o -path "*/_bundled" -o -path ./deploy/backups -o -path ./app/vendor \) -prune'
FILES="$(eval "find . ${PRUNE} -o -type f -print" 2>/dev/null | wc -l || echo 0)"
BYTES="$(eval "find . ${PRUNE} -o -type f -print0" 2>/dev/null | du -ch --files0-from=- 2>/dev/null | tail -1 | cut -f1 || true)"
echo "    추정: ${FILES} files, ${BYTES}"
[[ "${FILES}" -gt 30000 ]] && warn "파일 수 >30000 — .gcloudignore 점검"
BYTES_MB="$(echo "${BYTES}" | sed 's/[^0-9.]//g')"
if [[ "${BYTES}" == *G* ]] || { [[ "${BYTES}" == *M* ]] && [[ "$(echo "${BYTES_MB}" | cut -d. -f1)" -gt 500 ]] 2>/dev/null; }; then
  warn "용량 >500MB — 제출 전 gcloudignore 재확인"
fi

if [[ "${FAIL}" -ne 0 ]]; then
  echo ""
  echo "==> 검증 실패. deploy/README.md · DEPLOY-RECURRING-FAILURES.md 참고"
  exit 1
fi

echo "==> [v8-0] deploy recurring failure guards (RF)"
chmod +x "${ROOT}/deploy/check-deploy-recurring-guards.sh" 2>/dev/null || true
chmod +x "${ROOT}/deploy/run-layout-sync-job.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/check-deploy-recurring-guards.sh"; then
  FAIL=1
fi

echo "==> [v8] SaaS runtime invariants"
chmod +x "${ROOT}/deploy/check-saas-runtime-invariants.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/check-saas-runtime-invariants.sh"; then
  FAIL=1
fi

echo "==> [v8a] SaaS hospitals admin gate (i18n + layout sync pipeline)"
chmod +x "${ROOT}/deploy/saas-hospitals-admin-gate.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/saas-hospitals-admin-gate.sh"; then
  FAIL=1
fi

echo "==> [v8b2] module layout sync SSOT (admin 404 방지)"
chmod +x "${ROOT}/scripts/check-module-layout-sync-ssot.sh" 2>/dev/null || true
if ! "${ROOT}/scripts/check-module-layout-sync-ssot.sh"; then
  FAIL=1
fi

echo "==> [v8b] moabom-admin_basic SSOT (DoD-8)"
chmod +x "${ROOT}/deploy/check-moabom-admin-basic-ssot.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/check-moabom-admin-basic-ssot.sh"; then
  FAIL=1
fi

echo "==> [v8d] Moabom final refactor invariants"
chmod +x "${ROOT}/deploy/check-moabom-refactor-invariants.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/check-moabom-refactor-invariants.sh"; then
  FAIL=1
fi

if [[ "${FAIL}" -ne 0 ]]; then
  echo ""
  echo "==> 검증 실패 (v8). deploy/check-saas-runtime-invariants.sh 또는 deploy/check-moabom-refactor-invariants.sh"
  exit 1
fi

echo "==> [v8c] SNS OAuth broker smoke (Phase 5)"
chmod +x "${ROOT}/deploy/smoke-social-auth.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/smoke-social-auth.sh"; then
  FAIL=1
fi

if [[ "${FAIL}" -ne 0 ]]; then
  echo ""
  echo "==> 검증 실패 (v8c). deploy/smoke-social-auth.sh"
  exit 1
fi

echo "==> v7+v8 검증 통과 (이미지 태그: ${TAG})"
echo "    ./deploy/build-and-deploy.sh [--async]"
echo "    parity: bash deploy/saas-config-cache-parity.sh"
