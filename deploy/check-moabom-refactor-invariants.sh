#!/usr/bin/env bash
# Moabom final refactor invariants — platform kernel, app SDK, storage plane, design system, PWA.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
SYS="${APP}/modules/moabom-system"
BASIC="${APP}/templates/moabom-basic"
ADMIN="${APP}/templates/moabom-admin_basic"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok() { echo "OK:   $*"; }

require_file() {
  [[ -f "$1" ]] || fail "missing $1"
}

json_get() {
  python3 - "$1" "$2" <<'PYJSON'
import json, sys
path, expr = sys.argv[1:3]
cur = json.load(open(path, encoding='utf-8'))
for part in expr.split('.'):
    if part == '':
        continue
    cur = cur[part]
print(cur if not isinstance(cur, (dict, list)) else json.dumps(cur, ensure_ascii=False))
PYJSON
}

echo "== moabom-refactor-invariants =="

# 1. Platform kernel boundary: moabom-system must stay SaaS/settings/shell-boot focused.
API="${SYS}/src/routes/api.php"
PROVIDER="${SYS}/src/Providers/SystemServiceProvider.php"
COMPAT="${SYS}/src/routes/decomposition-compat.php"
for forbidden in   'WeatherCurrentController'   'AiAppController'   'UserMyPageActivityController'   'CpapMeasurementController'   'SimulationController'   'SocialAuthCallbackController'
do
  if grep -qs "$forbidden" "$API" "$PROVIDER" "${SYS}/config/moabom-system.php"; then
    fail "moabom-system kernel API/provider contains separated feature reference: ${forbidden}"
  fi
done
if [[ -f "$COMPAT" ]]; then
  grep -q 'class_exists' "$COMPAT" || fail "decomposition compat must be class_exists guarded"
  grep -q 'decomposition_compat' "$COMPAT" || fail "decomposition compat routes must stay explicitly named"
fi
require_file "${SYS}/src/Http/Controllers/PublicShellBootController.php"
require_file "${SYS}/src/Http/Controllers/Platform/SaasHospitalController.php"
require_file "${SYS}/src/Saas/TenantRuntimeBootstrap.php"
require_file "${SYS}/src/Saas/MoabomDbConfigRepository.php"
require_file "${SYS}/src/Saas/TenantModuleCategoryJsonStore.php"
ok "moabom-system kernel boundary smoke"

# 2. Storage plane: SaaS settings are DB-backed and not mixed with generic G7 driver choice.
require_file "${APP}/config/moabom-saas.php"
grep -q "MOABOM_SAAS_MODULE_SETTINGS_BACKEND', 'db'" "${APP}/config/moabom-saas.php"   || fail "moabom-saas module_settings_backend default must be db"
grep -q 'MOABOM_SAAS_MODULE_SETTINGS_BACKEND: "db"' "${ROOT}/deploy/production.env.yaml"   || fail "production env must keep SaaS module settings backend db"
grep -q 'moabom_module_settings' "${SYS}/src/Saas/MoabomDbConfigRepository.php"   || fail "MoabomDbConfigRepository must use moabom_module_settings"
grep -q "app()->environment('production')" "${SYS}/src/Saas/TenantModuleCategoryJsonStore.php"   || fail "TenantModuleCategoryJsonStore must force db backend in production"
grep -q "return 'db';" "${SYS}/src/Saas/TenantModuleCategoryJsonStore.php"   || fail "TenantModuleCategoryJsonStore production guard must return db"
PROVIDER="${APP}/app/Providers/SettingsServiceProvider.php"
grep -q 'applyStorageDriverConfig' "${PROVIDER}" \
  || fail "SettingsServiceProvider must apply storage_driver beyond filesystems.default"
grep -q "Config::set('attachment.disk', 'attachments')" "${PROVIDER}" \
  || fail "storage_driver must keep AttachmentService on the attachments named disk"
grep -q "if (\$driver !== 'gcs')" "${PROVIDER}" \
  || fail "local/s3 storage drivers must preserve G7 stock named disk definitions"
grep -q 'gcsDiskConfigFor' "${PROVIDER}" \
  || fail "GCS storage driver must map named disks to bucket prefixes"
grep -q "\['attachments', 'modules', 'plugins', 'public'\]" "${PROVIDER}" \
  || fail "GCS storage driver must sync Moabom file named disks"
grep -q "storage' => \['local', 's3', 'gcs'\]" "${APP}/app/Services/DriverRegistryService.php" \
  || fail "admin storage driver registry must expose local/s3/gcs"
grep -q "\"storage_driver\": \"gcs\"" "${APP}/config/settings/defaults.json" \
  || fail "Moabom default file storage driver must be gcs"
grep -q "'storage' => 'gcs'" "${APP}/app/Services/DriverRegistryService.php" \
  || fail "DriverRegistryService storage fallback must be gcs"
grep -q "FILESYSTEM_DISK: gcs" "${ROOT}/deploy/production.env.yaml" \
  || fail "production env must default runtime file storage to GCS"
grep -q "SUPPORTED_STORAGE_DRIVERS = \['local', 's3', 'gcs'\]" "${APP}/app/Http/Requests/Settings/SaveSettingsRequest.php" \
  || fail "admin storage driver save validation must allow gcs"
grep -q "SUPPORTED_STORAGE_DRIVERS = \['local', 's3', 'gcs'\]" "${APP}/app/Http/Requests/Settings/TestDriverConnectionRequest.php" \
  || fail "admin storage driver test validation must allow gcs"
if grep -q "'settings'" "${PROVIDER}" || grep -q '"settings"' "${PROVIDER}"; then
  fail "storage_driver must not remap settings disk out of the bootstrap SSOT plane"
fi
ok "storage/settings plane split"

# 3. App SDK: every app.json shell chunk must match a shellRegister entry or explicit create-app config.
for manifest in "${APP}/modules"/moabom-*/app.json; do
  [[ -f "$manifest" ]] || continue
  id="$(json_get "$manifest" id)"
  module="$(basename "$(dirname "$manifest")")"
  template="$(json_get "$manifest" frontend.template)"
  chunk="$(json_get "$manifest" frontend.chunk)"
  global="$(json_get "$manifest" frontend.global)"
  [[ "$template" == "moabom-basic" ]] || fail "${module}/app.json frontend.template must be moabom-basic"
  [[ "$chunk" == "moabom-shell-${id}.iife.js" ]] || fail "${module}/app.json chunk mismatch for ${id}: ${chunk}"
  [[ "$global" == "$id" ]] || fail "${module}/app.json frontend.global must equal app id"
  if [[ "$id" == "create-app" ]]; then
    require_file "${BASIC}/vite.shell-create-app.config.ts"
  else
    require_file "${BASIC}/src/apps/${id}/shellRegister.ts"
  fi
done
require_file "${BASIC}/scripts/build-shell-apps.cjs"
grep -q 'shellRegister.ts' "${BASIC}/scripts/build-shell-apps.cjs"   || fail "shell app builder must discover shellRegister.ts"
grep -q 'shellBootChunkFileFor' "${BASIC}/src/apps/index.ts"   || fail "shell app loader must consume shell-boot manifest chunks"
grep -q "Route::prefix('apps')->middleware(\\['auth:sanctum'\\])" "${APP}/modules/moabom-apps/src/routes/api.php"   || fail "generated app data API must be auth:sanctum scoped"
grep -q 'findForUser' "${APP}/modules/moabom-apps/src/Repositories/GeneratedAppRepository.php"   || fail "generated app repository must enforce per-user reads"
ok "app.json app SDK + shell chunk contract"

# 4. Network/PWA: shell boot, lazy chunks, lazy precache, gzip core engine, deferred extension handler.
grep -q 'public/shell-boot' "${SYS}/src/routes/api.php"   || fail "shell-boot route missing"
grep -q 'loadMoabomShellAppComponent' "${BASIC}/src/pages/home/MoabomShellAppFromChunk.tsx"   || fail "shell window must lazy-load app chunks"
grep -q 'postMoabomLazyPrecache' "${BASIC}/src/apps/index.ts"   || fail "shell chunk loader must post lazy precache"
grep -q 'MOABOM_LAZY_PRECACHE' "${APP}/plugins/moabom-pwa/resources/pwa/sw.template.js"   || fail "PWA SW lazy precache handler missing"
grep -q 'template-engine.min.js' "${ROOT}/deploy/nginx-cloudrun.conf"   || fail "nginx gzip/static policy must mention template-engine.min.js"
grep -q 'loadDeferredExtensionAssets' "${APP}/resources/js/core/template-engine/ActionDispatcher.ts"   || fail "ActionDispatcher missing loadDeferredExtensionAssets handler"
ok "network-first shell/PWA invariants"

# 5. Hospital flow: note UI contract + logo multipart + public cache invalidation.
CREATE="${SYS}/resources/layouts/admin/admin_saas_hospital_create.json"
LIST="${SYS}/resources/layouts/admin/admin_saas_hospitals.json"
grep -q 'field_note' "$CREATE" || fail "hospital create must label memo/note"
grep -q '"note"' "$CREATE" || fail "hospital create must submit note"
grep -q 'multipart/form-data' "$CREATE" || fail "hospital create must keep multipart logos"
grep -q 'logo_light' "$CREATE" && grep -q 'logo_dark' "$CREATE"   || fail "hospital create must keep light/dark logo upload"
grep -q '\$event.target.files?.\[0\] || \$event.target.value' "$CREATE"   || fail "hospital logo FileInput must keep File object, not filename string"
grep -q 'isFileLike' "${APP}/resources/js/core/template-engine/ActionDispatcher.ts"   || fail "ActionDispatcher must keep File/Blob multipart parts"
grep -q 'item.note || item.region' "$LIST"   || fail "hospital list must display note with legacy region fallback"
grep -q 'SiteLogoPublicCacheInvalidator' "${SYS}/src/Saas/TenantSiteLogoBootstrapper.php"   || fail "tenant logo bootstrapper must invalidate public cache"
ok "hospital note/logo contracts"

# 6. Design system: enforce semantic preset presence and prevent hospital admin page from regressing to only raw long forms.
grep -q 'MOABOM_ADMIN_FIELD_INPUT' "${ADMIN}/src/theme/moabomAdminSurfaces.ts"   || fail "admin surface field preset missing"
grep -q 'APP_SHELL_INPUT_CLASS' "${BASIC}/src/apps/appShellTypography.ts"   || fail "user app shell input preset missing"
grep -q 'moaFieldControlClass' "${BASIC}/src/theme/moabomFieldSurface.ts"   || fail "user field semantic token builder missing"
grep -q 'admin-field-input' "${ADMIN}/src/styles/ui-system/components.css"   || fail "admin CSS semantic field class missing"
grep -q 'admin-field-input' "$CREATE"   || fail "hospital create layout must use admin-field-input semantic class"
ok "design-system preset contract"

# 7b. Test runner delegation: root vitest must not pull template suites raw (false-failure guard).
ROOT_VITEST="${APP}/vitest.config.ts"
RUNNER="${APP}/scripts/vitest-all.mjs"
PKG="${APP}/package.json"
require_file "${ROOT_VITEST}"
require_file "${RUNNER}"
# 루트 config 의 include 블록에 template src 가 있으면 alias/toolchain 이중화로 거짓 실패가 난다.
INCLUDE_BLOCK="$(awk '/include:[[:space:]]*\[/{f=1} f{print} /\]/{if(f)exit}' "${ROOT_VITEST}")"
if grep -q 'templates/.*/src' <<<"${INCLUDE_BLOCK}"; then
  fail "root vitest.config.ts include must NOT list templates/**/src (delegate via scripts/vitest-all.mjs)"
fi
grep -q "templates/\*\*/src/\*\*" "${ROOT_VITEST}" \
  || fail "root vitest.config.ts must exclude templates/**/src defensively"
grep -q 'discoverActiveSuites' "${RUNNER}" \
  || fail "vitest-all runner must discover active moabom-* suites by their own config"
grep -q 'hasOwnVitest' "${RUNNER}" \
  || fail "vitest-all runner must run each suite with its own installed vitest toolchain"
grep -q '"test:run": "node scripts/vitest-all.mjs"' "${PKG}" \
  || fail "package.json test:run must delegate to scripts/vitest-all.mjs"
ok "test runner delegation (no template false-failures)"

# 7. Cleanup/build gates: generated noise must stay out of Cloud Build input.
grep -q '_bundled' "${ROOT}/.gcloudignore" || fail ".gcloudignore must exclude _bundled"
grep -q '\*\*/dist/' "${ROOT}/.gcloudignore" || fail ".gcloudignore must exclude dist"
grep -q 'agent-transcripts' "${ROOT}/.gcloudignore" || fail ".gcloudignore must exclude agent transcripts"
grep -q 'moabom-refactor-invariants' "${ROOT}/deploy/check-before-cloud-build.sh"   || fail "check-before-cloud-build.sh must run this refactor gate"
ok "cleanup/deploy gate linkage"

if [[ "$FAIL" -ne 0 ]]; then
  echo "== moabom-refactor-invariants FAILED =="
  exit 1
fi

echo "== moabom-refactor-invariants PASSED =="
