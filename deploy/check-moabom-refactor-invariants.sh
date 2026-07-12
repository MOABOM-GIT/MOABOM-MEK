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
grep -q "'storage_driver' => 'gcs'" "${SYS}/src/Saas/TenantSettingsSeeder.php" \
  || fail "tenant settings seeder must keep new tenant storage_driver default on gcs"
grep -q 'MoabomJsonConfigRepository::class' "${SYS}/src/Providers/SystemServiceProvider.php" \
  || fail "moabom-system provider must bind the JSON config repository extension"
grep -q 'GcsCoreSettingsJsonSync::writeCategory' "${SYS}/src/Saas/MoabomDbConfigRepository.php" \
  || fail "MoabomDbConfigRepository must sync drivers/settings JSON to GCS on save"
grep -q 'PlatformBootSettingsRepository' "${SYS}/src/Saas/PlatformBootSettingsRepository.php" \
  || fail "PlatformBootSettingsRepository must exist for boot-time DB-first settings"
grep -q 'resolveBootConfigRepository' "${APP}/app/Providers/SettingsServiceProvider.php" \
  || fail "SettingsServiceProvider must resolve platform DB-first boot settings repository"
grep -q 'MoabomStorageDriverConfigApplier::apply' "${SYS}/src/Saas/SaasCoreSettingsHydrator.php" \
  || fail "SaasCoreSettingsHydrator must apply storage_driver from DB snapshot"
require_file "${SYS}/src/Saas/GcsModuleSettingsJsonSync.php"
require_file "${SYS}/src/Saas/MoabomModuleCategoryDbStore.php"
grep -q 'GcsModuleSettingsJsonSync::write' "${SYS}/src/Saas/MoabomModuleCategoryDbStore.php" \
  || fail "MoabomModuleCategoryDbStore must mirror module settings JSON to modules disk"
grep -q 'shouldDelegateToDbRepository' "${SYS}/src/Repositories/MoabomJsonConfigRepository.php" \
  || fail "MoabomJsonConfigRepository must delegate to DB repository when SaaS is enabled"
grep -q 'MoabomSaasPersistentModuleSettings' "${ROOT}/app/modules/moabom-credit/src/Services/CreditSettingsService.php" \
  || fail "CreditSettingsService must persist settings via MoabomSaasPersistentModuleSettings in SaaS"
grep -q 'MoabomSaasPersistentModuleSettings' "${ROOT}/app/modules/sirsoft-board/src/Services/BoardSettingsService.php" \
  || fail "BoardSettingsService must persist settings via MoabomSaasPersistentModuleSettings in SaaS"
grep -q 'MoabomSaasPersistentModuleSettings' "${ROOT}/app/modules/sirsoft-ecommerce/src/Services/EcommerceSettingsService.php" \
  || fail "EcommerceSettingsService must persist settings via MoabomSaasPersistentModuleSettings in SaaS"
grep -q 'MoabomDbConfigRepository::class' "${SYS}/src/Providers/SystemServiceProvider.php" \
  || fail "moabom-system provider must bind the DB-backed G7 core settings repository"
grep -q 'configureCoreRuntimeGuards()' "${SYS}/src/Providers/SystemServiceProvider.php" \
  || fail "moabom-system provider must inject core runtime guards from the extension layer"
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
grep -q 'extension_loaded($ext)' "${APP}/app/Services/SettingsService.php" \
  || fail "system info php_extensions must remain bool extension_loaded flags"
if grep -q "'settings'" "${PROVIDER}" || grep -q '"settings"' "${PROVIDER}"; then
  fail "storage_driver must not remap settings disk out of the bootstrap SSOT plane"
fi
ok "storage/settings plane split"

# 2b. G7 SPA View Composer 계약 — Moabom 래퍼가 코어 생성자 시그니처를 깨면 HTML 전면 500
CORE_USER_COMPOSER="${APP}/app/Http/View/Composers/UserTemplateComposer.php"
CORE_ADMIN_COMPOSER="${APP}/app/Http/View/Composers/TemplateComposer.php"
MOA_USER_COMPOSER="${SYS}/src/Http/View/Composers/MoabomUserTemplateComposer.php"
MOA_ADMIN_COMPOSER="${SYS}/src/Http/View/Composers/MoabomTemplateComposer.php"
require_file "${MOA_USER_COMPOSER}"
require_file "${MOA_ADMIN_COMPOSER}"
if grep -q 'TemplateManager \$templateManager' "${CORE_USER_COMPOSER}"; then
  grep -q 'TemplateManager \$moabomTemplateManager\|TemplateManager \$templateManager' "${MOA_USER_COMPOSER}" \
    || fail "MoabomUserTemplateComposer must accept TemplateManager (G7 SPA compose contract)"
  grep -A30 'parent::__construct' "${MOA_USER_COMPOSER}" | grep -q 'TemplateManager\|moabomTemplateManager\|templateManager' \
    || fail "MoabomUserTemplateComposer must pass TemplateManager to parent::__construct"
  for key in extensionCacheVersion bundleUrls templateExternals activeModulesMeta activePluginsMeta shellCritical; do
    grep -q "'${key}'" "${MOA_USER_COMPOSER}" \
      || fail "MoabomUserTemplateComposer buildViewData must provide G7 key: ${key}"
  done
  grep -q 'MoabomUserSurfaceBootAssetPolicy' "${MOA_USER_COMPOSER}" \
    || fail "MoabomUserTemplateComposer must apply home-shell force-defer policy"
  grep -q 'MoabomShellCriticalSnapshot' "${MOA_USER_COMPOSER}" \
    || fail "MoabomUserTemplateComposer must inject shellCritical snapshot"
fi
if grep -q 'TemplateManager \$templateManager' "${CORE_ADMIN_COMPOSER}"; then
  grep -q 'TemplateManager \$templateManager' "${MOA_ADMIN_COMPOSER}" \
    || fail "MoabomTemplateComposer must accept TemplateManager (G7 SPA compose contract)"
  grep -A20 'parent::__construct' "${MOA_ADMIN_COMPOSER}" | grep -q 'templateManager' \
    || fail "MoabomTemplateComposer must pass TemplateManager to parent::__construct"
fi
ok "G7 SPA View Composer contract (Moabom wrappers)"

grep -q '__MOABOM_SHELL_CRITICAL__' "${APP}/resources/views/app.blade.php" \
  || fail "app.blade.php must expose window.__MOABOM_SHELL_CRITICAL__"
grep -q 'installMoabomShellCriticalFetch' "${BASIC}/src/index.ts" \
  || fail "moabom-basic must install shell critical fetch patch"
grep -q 'networkTimeoutSeconds: 0.4' "${APP}/plugins/moabom-pwa/resources/pwa/sw.template.js" \
  || fail "PWA SW HTML NetworkFirst timeout must be 0.4s"
grep -q 'WEBSITE_ICON_CACHE' "${APP}/plugins/moabom-pwa/resources/pwa/sw.template.js" \
  || fail "PWA SW must CacheFirst website-icon"
grep -q 'websiteIconCacheKeyPlugin' "${APP}/plugins/moabom-pwa/resources/pwa/sw.template.js" \
  || fail "PWA SW website-icon must cache by pathname (ignore icon_token)"
grep -q 'moabom:warm-template-lang-static' "${ROOT}/deploy/cloudrun-entrypoint.sh" \
  || fail "entrypoint must warm merged template lang for nginx"
grep -q 'ext-static/lang/\$tpl_id/\$locale.json' "${ROOT}/deploy/nginx-cloudrun.conf" \
  || fail "nginx must serve warmed template lang JSON"
ok "network boot critical path (shellCritical + force-defer + SW + lang static)"

[[ -f "${APP}/modules/moabom-apps/src/Services/MoabomShellHomeAppOrderPruner.php" ]] \
  || fail "MoabomShellHomeAppOrderPruner missing"
grep -q 'MoabomShellHomeAppOrderPruner' "${APP}/modules/moabom-apps/src/Http/Controllers/AiAppController.php" \
  || fail "AiAppController destroy must prune shell.home generated ids"
ok "generated-app shell.home prune on destroy"

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

# 4. Network/PWA: shell boot, lazy chunks, lazy precache, gzip core engine, deferred extension loading via G7 reload handlers.
grep -q 'public/shell-boot' "${SYS}/src/routes/api.php"   || fail "shell-boot route missing"
grep -q 'loadMoabomShellAppComponent' "${BASIC}/src/pages/home/MoabomShellAppFromChunk.tsx"   || fail "shell window must lazy-load app chunks"
grep -q 'postMoabomLazyPrecache' "${BASIC}/src/apps/index.ts"   || fail "shell chunk loader must post lazy precache"
grep -q 'MOABOM_LAZY_PRECACHE' "${APP}/plugins/moabom-pwa/resources/pwa/sw.template.js"   || fail "PWA SW lazy precache handler missing"
grep -q 'template-engine.min.js' "${ROOT}/deploy/nginx-cloudrun.conf"   || fail "nginx gzip/static policy must mention template-engine.min.js"
grep -qE 'reloadModuleHandlers|ensureShellAppDeferredExtensions' "${BASIC}/src/pages/home/MoabomShellAppFromChunk.tsx"   || fail "shell window must preload deferred modules via G7 reloadModuleHandlers"
grep -q 'reloadPluginHandlers' "${BASIC}/src/runtime/sirsoftEcommerceLayoutPrefetch.ts"   || fail "layout prefetch must preload deferred plugins via G7 reloadPluginHandlers"
ok "network-first shell/PWA invariants"

# 5. Hospital flow: note UI contract + logo multipart + public cache invalidation.
CREATE="${SYS}/resources/layouts/admin/admin_saas_hospital_create.json"
LIST="${SYS}/resources/layouts/admin/admin_saas_hospitals.json"
grep -q 'field_note' "$CREATE" || fail "hospital create must label memo/note"
grep -q '"note"' "$CREATE" || fail "hospital create must submit note"
grep -q 'multipart/form-data' "$CREATE" || fail "hospital create must keep multipart logos"
grep -q 'logo_light' "$CREATE" && grep -q 'logo_dark' "$CREATE"   || fail "hospital create must keep light/dark logo upload"
grep -q '\$event.target.files?.\[0\] || \$event.target.value' "$CREATE"   || fail "hospital logo FileInput must keep File object, not filename string"
grep -q 'value instanceof File || value instanceof Blob' "${APP}/resources/js/core/template-engine/ActionDispatcher.ts"   || fail "ActionDispatcher must keep G7 pure File/Blob multipart parts"
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

# 8. WS-first / lazy-load realtime invariants (shell performance refactor)
CHAT_SYNC="${BASIC}/src/runtime/moabomShellChatSyncService.ts"
PRESENCE_PROVIDER="${BASIC}/src/hooks/MoabomPresenceProvider.tsx"
PRESENCE_HOOK="${BASIC}/src/hooks/useMoabomPresence.ts"
require_file "${CHAT_SYNC}"
require_file "${BASIC}/src/shell/moabomShellUnreadBadge.ts"
# 상시 unread REST 폴링 금지 (WS 연결 중 setInterval unread 제거)
if grep -qE 'MOABOM_NOTIFICATION_UNREAD_POLL_MS|unreadPollTimer' "${CHAT_SYNC}"; then
  fail "moabomShellChatSyncService must not keep always-on unread REST polling"
fi
grep -q 'scheduleDisconnectedPolling' "${CHAT_SYNC}" \
  || fail "chat sync must gate REST polling to WS-disconnected only"
grep -q 'presenceSurfaceActive' "${PRESENCE_PROVIDER}" \
  || fail "MoabomPresenceProvider must gate heartbeat/revision on presenceSurfaceActive"
grep -q 'setPresenceSurfaceActive' "${PRESENCE_HOOK}" \
  || fail "useMoabomPresence must activate presence surface only on connect/friend tabs"
# 전역 tertiary board/profile layout prefetch 제거 — 창 오픈 시만
if grep -q 'schedulePrefetchBoardWindowLayouts' "${BASIC}/src/index.ts"; then
  fail "moabom-basic index must not schedule global board layout prefetch"
fi
if grep -q 'schedulePrefetchUserProfileWindowLayouts' "${BASIC}/src/index.ts"; then
  fail "moabom-basic index must not schedule global profile layout prefetch"
fi
ADMIN_BASE="${ADMIN}/layouts/_admin_base.json"
# 관리자 알림 목록은 드롭다운 오픈 시 fetch (전역 auto_fetch 금지)
python3 - "${ADMIN_BASE}" <<'PYADMIN' || fail "admin notifications data_source must keep auto_fetch false"
import json, sys
layout = json.load(open(sys.argv[1], encoding="utf-8"))
notif = next((d for d in layout.get("data_sources", []) if d.get("id") == "notifications"), None)
assert notif is not None, "notifications data_source missing"
assert notif.get("auto_fetch") is False, "notifications auto_fetch must be false"
ws = next((d for d in layout.get("data_sources", []) if d.get("id") == "notification_ws"), None)
assert ws is not None, "notification_ws missing"
recv = ws.get("onReceive") or []
refetch_ids = [
    a.get("params", {}).get("dataSourceId")
    for a in recv
    if a.get("handler") == "refetchDataSource"
]
assert "notification_unread_count" in refetch_ids, "ws must refetch unread count"
assert "notifications" not in refetch_ids, "ws must not refetch full notifications list"
PYADMIN
grep -q 'nodeMayContainFormControls\|FORM_CONTROL_SELECTOR' \
  "${APP}/plugins/moabom-auth-hardening/resources/js/observer.ts" \
  || fail "auth-hardening observer must filter to form-control mutations"
ok "WS-first / lazy-load realtime invariants"

# 8b. Icon 컴포넌트 사용 템플릿은 Font Awesome externals 필수 (G7 7.0.2+)
python3 - "${BASIC}/template.json" "${ADMIN}/template.json" <<'PYFA' || fail "moabom templates with icon must declare fontawesome externals"
import json, sys
for path in sys.argv[1:]:
    data = json.load(open(path, encoding="utf-8"))
    basic = (data.get("components") or {}).get("basic") or []
    if "icon" not in basic:
        continue
    externals = data.get("externals") or []
    urls = " ".join(str(e.get("url", "")) for e in externals if isinstance(e, dict))
    ids = {e.get("id") for e in externals if isinstance(e, dict)}
    assert "fontawesome" in ids or "font-awesome" in urls, f"{path}: missing fontawesome externals"
    assert "cdnjs.cloudflare.com/ajax/libs/font-awesome/" in urls, f"{path}: fontawesome URL missing"
print("OK fontawesome externals")
PYFA
ok "Font Awesome externals (icon templates)"

# 9. SaaS host spoofing guard (TenantRequestHost + LB ingress)
HOST_RESOLVER="${APP}/modules/moabom-system/src/Saas/TenantRequestHost.php"
require_file "${HOST_RESOLVER}"
grep -q 'isAllowedSaaSHost' "${HOST_RESOLVER}" \
  || fail "TenantRequestHost must allowlist SaaS hosts before accepting X-Forwarded-Host"
grep -q 'isCloudRunDefaultHost' "${HOST_RESOLVER}" \
  || fail "TenantRequestHost must treat *.run.app as Cloud Run default host"
grep -q 'internal-and-cloud-load-balancing' "${ROOT}/deploy/lib/cloud-run-service-flags.sh" \
  || fail "Cloud Run ingress must be LB-only (internal-and-cloud-load-balancing)"
ok "SaaS host spoofing guard (code + ingress SSOT)"

# 10. Shell HTTP / Auth / Resource Plane (moabom-shell-resource-plane.md)
MYPAGE_API="${BASIC}/src/components/composite/mypage/myPageApi.ts"
ACTIVITY_LEVEL="${BASIC}/src/hooks/useMoabomActivityLevel.ts"
SHELL_HTTP="${BASIC}/src/api/moabomShellHttp.ts"
require_file "${MYPAGE_API}"
require_file "${ACTIVITY_LEVEL}"
require_file "${SHELL_HTTP}"

# mypage 모듈 credit/personalization 은 createShellModuleApi — moabomApi* 로 modules 경로 호출 금지
if grep -E 'moabomApi(Get|Post|Put|Delete)<[^>]*>\([^)]*/api/modules/' "${MYPAGE_API}" >/dev/null 2>&1; then
  fail "myPageApi must not call /api/modules/* via moabomAuthenticatedApi"
fi
grep -q "createShellModuleApi('moabom-credit')" "${MYPAGE_API}" \
  || fail "myPageApi must use createShellModuleApi('moabom-credit')"
grep -q "createShellModuleApi('moabom-personalization')" "${MYPAGE_API}" \
  || fail "myPageApi must use createShellModuleApi('moabom-personalization')"

# ActivityLevel: fetch 성공 직후 notifyListeners() 재fetch 루프 금지 — 값 push 리스너만
if grep -n 'notifyListeners()' "${ACTIVITY_LEVEL}" | grep -v 'function notifyListeners' | grep -v 'progress' >/dev/null 2>&1; then
  # allow notifyListeners(progress) value-push; forbid bare notifyListeners() after fetch
  if grep -E '^\s*notifyListeners\(\);\s*$' "${ACTIVITY_LEVEL}" >/dev/null 2>&1; then
    fail "useMoabomActivityLevel must not call bare notifyListeners() (feedback loop)"
  fi
fi
grep -q 'ActivityLevelListener' "${ACTIVITY_LEVEL}" \
  || fail "useMoabomActivityLevel must use value-push ActivityLevelListener"
grep -q 'MOABOM_SHELL_AUTH_EXPIRED_EVENT' "${SHELL_HTTP}" \
  || fail "moabomShellHttp must publish MOABOM_SHELL_AUTH_EXPIRED_EVENT on 401"
ok "Shell HTTP/Auth/Resource Plane guards"

if [[ "$FAIL" -ne 0 ]]; then
  echo "== moabom-refactor-invariants FAILED =="
  exit 1
fi

echo "== moabom-refactor-invariants PASSED =="
