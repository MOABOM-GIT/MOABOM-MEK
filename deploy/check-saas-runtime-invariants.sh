#!/usr/bin/env bash
# SaaS Runtime Invariants (v8) — 증상 patch 방지, 배포 전 정적 검증
# SAAS-PHASE2-ARCHITECTURE.md §3.0 · PROJECT-ADMIN-SAAS-REBUILD.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
ACTIVE_SYS="${APP}/modules/moabom-system"
CACHE_CFG="${APP}/config/cache.php"
CORE_JSON="${APP}/app/Repositories/JsonConfigRepository.php"
PROVIDER="${ACTIVE_SYS}/src/Providers/SystemServiceProvider.php"
FAIL=0

fail() { echo "ERROR: $*"; FAIL=1; }
warn() { echo "WARN:  $*"; }
ok()   { echo "    OK: $*"; }

echo "==> [v8-1] config/cache.php — TTL은 config:cache 후 config() 로만 읽음"
[[ -f "${CACHE_CFG}" ]] || fail "config/cache.php 없음"
grep -q "g7_json_settings_ttl" "${CACHE_CFG}" || fail "cache.g7_json_settings_ttl 없음"
grep -q "moabom_public_boot_ttl" "${CACHE_CFG}" || fail "cache.moabom_public_boot_ttl 없음"
ok "cache.g7_json_settings_ttl + moabom_public_boot_ttl"

echo "==> [v8-2] settings·public boot — env() 금지 (config 파일 제외)"
for f in \
  "${ACTIVE_SYS}/src/Repositories/MoabomJsonConfigRepository.php" \
  "${ACTIVE_SYS}/src/Support/MoabomPublicApiCache.php" \
  "${CORE_JSON}"
do
  [[ -f "${f}" ]] || fail "$(basename "${f}") 없음"
  if grep -qE "env\(['\"]G7_JSON_SETTINGS_CACHE_TTL|env\(['\"]MOABOM_PUBLIC_BOOT_CACHE_TTL" "${f}" 2>/dev/null; then
    fail "$(basename "${f}") 에 runtime env(TTL) — config('cache.*') 사용"
  fi
done
grep -q "config('cache.g7_json_settings_ttl'" "${CORE_JSON}" \
  || fail "JsonConfigRepository 가 config('cache.g7_json_settings_ttl') 미사용"
grep -q "config('cache.g7_json_settings_ttl'" "${ACTIVE_SYS}/src/Repositories/MoabomJsonConfigRepository.php" \
  || fail "MoabomJsonConfigRepository 가 config TTL 미사용"
grep -q "config('cache.moabom_public_boot_ttl'" "${ACTIVE_SYS}/src/Support/MoabomPublicApiCache.php" \
  || fail "MoabomPublicApiCache 가 config TTL 미사용"
ok "TTL → config('cache.*')"

echo "==> [v8-3] tenant-scoped DI — singleton + ConfigRepository 금지"
grep -q 'scoped(SaasCoreSettingsHydrator::class)' "${PROVIDER}" \
  || fail "SaasCoreSettingsHydrator 는 scoped 여야 함 (singleton → platform memo leak)"
grep -q 'scoped(TenantExperienceDefaultsReader::class)' "${PROVIDER}" \
  || fail "TenantExperienceDefaultsReader 는 scoped 여야 함"
if grep -q 'singleton(SaasCoreSettingsHydrator::class)' "${PROVIDER}" 2>/dev/null; then
  fail "SaasCoreSettingsHydrator singleton 금지"
fi
ok "Hydrator·DefaultsReader scoped"

echo "==> [v8-4] TenantRuntimeBootstrap — settings memo reset"
BOOT="${ACTIVE_SYS}/src/Saas/TenantRuntimeBootstrap.php"
grep -q 'resetSettingsRepositoryMemo' "${BOOT}" \
  || fail "TenantRuntimeBootstrap.resetSettingsRepositoryMemo 없음"
grep -q 'resetRequestState' "${ACTIVE_SYS}/src/Repositories/MoabomJsonConfigRepository.php" \
  || fail "MoabomJsonConfigRepository.resetRequestState 없음"
ok "bootstrap 시 categoryMemo reset"

echo "==> [v8-4b] TenantRuntimeBootstrap — scoped 의존성 생성자 주입 금지"
if grep -qE 'private readonly TenantContext|private readonly SaasCoreSettingsHydrator' "${BOOT}" 2>/dev/null; then
  fail "TenantRuntimeBootstrap 이 scoped TenantContext/Hydrator 를 생성자 주입 — forgetScoped 후 stale"
fi
grep -q 'tenantContext()' "${BOOT}" || fail "TenantRuntimeBootstrap.tenantContext() app() resolve 없음"
grep -q 'settingsHydrator()' "${BOOT}" || fail "TenantRuntimeBootstrap.settingsHydrator() app() resolve 없음"
ok "bootstrap → app(TenantContext) per call"

echo "==> [v8-4c] config:cache 후 SaaS env bridge (getenv)"
BRIDGE="${ACTIVE_SYS}/src/Saas/SaasCachedConfigBridge.php"
[[ -f "${BRIDGE}" ]] || fail "SaasCachedConfigBridge.php 없음"
grep -q 'SaasCachedConfigBridge::applyIfNeeded' "${PROVIDER}" \
  || fail "SystemServiceProvider 가 SaasCachedConfigBridge 미호출"
grep -q 'configurationIsCached' "${BRIDGE}" || fail "SaasCachedConfigBridge.configurationIsCached 없음"
grep -q "getenv('MOABOM_SAAS_ENABLED')" "${BRIDGE}" \
  || fail "SaasCachedConfigBridge 가 MOABOM_SAAS_ENABLED getenv 미사용"
ok "config:cache + MOABOM_SAAS_* getenv 재주입"

echo "==> [v8-4d] config/moabom-saas.php — config:cache SSOT"
[[ -f "${APP}/config/moabom-saas.php" ]] || fail "app/config/moabom-saas.php 없음"
grep -q "config('moabom-saas.enabled'" "${ACTIVE_SYS}/config/moabom-system.php" \
  || fail "moabom-system saas.enabled 가 config(moabom-saas) 참조 아님"
grep -q "MOABOM_SAAS_MODULE_SETTINGS_BACKEND: \"db\"" "${ROOT}/deploy/production.env.yaml" \
  || fail "production.env.yaml 의 MOABOM_SAAS_MODULE_SETTINGS_BACKEND 는 db 여야 함"
grep -q "MOABOM_SAAS_MODULE_SETTINGS_BACKEND', 'db'" "${APP}/config/moabom-saas.php" \
  || fail "moabom-saas.module_settings_backend 기본값은 db 여야 함"
grep -q 'MoabomSystemAdminMenus::forCurrentRequest' "${ACTIVE_SYS}/module.php" \
  || fail "getAdminMenus → MoabomSystemAdminMenus 미위임"
[[ -f "${ACTIVE_SYS}/src/Extension/MoabomSystemAdminMenus.php" ]] \
  || fail "MoabomSystemAdminMenus.php 없음"
ok "moabom-saas.php + module_settings_backend=db + Host별 admin 메뉴"

echo "==> [v8-5] public API cache keys — tenant slug 포함"
KEYS="${ACTIVE_SYS}/src/Support/MoabomPublicApiCacheKeys.php"
grep -q 'tenantScopeToken' "${KEYS}" || fail "MoabomPublicApiCacheKeys.tenantScopeToken 없음"
grep -q 'self::tenantScopeToken()' "${KEYS}" || fail "shell_boot 키에 tenantScopeToken 미포함"
ok "MoabomPublicApiCacheKeys tenant scope"

echo "==> [v8-6] PDO·platform DB — SaasMysqlPdoFactory (config 기반)"
[[ -f "${ACTIVE_SYS}/src/Saas/SaasMysqlPdoFactory.php" ]] || fail "SaasMysqlPdoFactory.php 없음"
if grep -qE "env\(['\"]DB_WRITE" "${ACTIVE_SYS}/src/Saas/TenantDatabaseCloner.php" 2>/dev/null; then
  fail "TenantDatabaseCloner 가 runtime env(DB_*) 사용 — SaasMysqlPdoFactory 로 교체"
fi
ok "TenantDatabaseCloner → SaasMysqlPdoFactory"

echo "==> [v8-7] provision v2 기본 경로"
grep -q "mode = 'package'" "${ACTIVE_SYS}/src/Saas/TenantProvisioner.php" \
  || fail "TenantProvisioner package 기본 mode 없음"
grep -q 'TenantIdentityBootstrapper' "${ACTIVE_SYS}/src/Saas/TenantProvisioner.php" \
  || fail "TenantProvisioner → TenantIdentityBootstrapper 없음"
[[ -f "${ROOT}/deploy/lib/cloud-run-artisan-job.sh" ]] \
  || fail "cloud-run-artisan-job.sh 없음 (운영 Job SSOT)"
[[ -f "${ROOT}/deploy/saas-tenant-admin-token-job.sh" ]] \
  || fail "saas-tenant-admin-token-job.sh 없음"
[[ -f "${ACTIVE_SYS}/src/Saas/TenantIdentityBootstrapper.php" ]] \
  || fail "TenantIdentityBootstrapper SSOT 없음"
[[ -f "${ACTIVE_SYS}/src/Saas/TenantLocalStorageEnsurer.php" ]] \
  || fail "TenantLocalStorageEnsurer SSOT 없음"
[[ -f "${ACTIVE_SYS}/src/Console/Commands/SaasTenantBootstrapIdentityCommand.php" ]] \
  || fail "SaasTenantBootstrapIdentityCommand 없음 (legacy → v2)"
[[ -f "${ACTIVE_SYS}/database/saas/packages/hospital-default.json" ]] \
  || fail "hospital-default.json package SSOT 없음"
ok "package bootstrap + identity + storage SSOT"

echo "==> [v8-8] platform SaaS hospitals UI + route guard"
API="${ACTIVE_SYS}/src/routes/api.php"
for f in \
  "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospital_create.json" \
  "${ACTIVE_SYS}/resources/routes/admin.json"
do
  [[ -f "${f}" ]] || fail "$(basename "${f}") 없음"
done
grep -q 'RequireMoabomPlatformHost::class' "${API}" \
  || fail "platform/saas/hospitals 라우트에 RequireMoabomPlatformHost 없음"
grep -q 'TenantHostParser' "${ACTIVE_SYS}/src/Http/Middleware/RequireMoabomPlatformHost.php" \
  || fail "RequireMoabomPlatformHost 는 Request Host 직접 판별 (TenantContext 순서 의존 금지)"
grep -q 'prependMiddlewareToGroup(.api., RestrictPlatformApiToPlatformHost::class)' "${PROVIDER}" \
  || fail "RestrictPlatformApiToPlatformHost 가 api 그룹 최상단에 prepend 되어야 함"
grep -q 'RequireMoabomPlatformHost::class, .auth:sanctum' "${API}" \
  || fail "platform guard 가 auth:sanctum 보다 앞서야 함 (tenant Host 404)"
grep -q 'singleton(TenantProvisionerInterface::class, TenantProvisioner::class)' "${PROVIDER}" \
  || fail "TenantProvisionerInterface → TenantProvisioner bind 없음 (final class mock·DI)"
grep -q "'action' => 'read'" "${ACTIVE_SYS}/module.php" \
  && grep -q "'identifier' => 'saas'" "${ACTIVE_SYS}/module.php" \
  || fail "module.php saas permissions 없음"
ok "platform hospitals UI + guard order + provisioner bind"

echo "==> [v8-9] platform 레지스트리 마이그레이션 + display 컬럼"
PLATFORM_MIG="${ACTIVE_SYS}/database/migrations/platform"
[[ -d "${PLATFORM_MIG}" ]] || fail "database/migrations/platform/ 경로 없음 (SaasPlatformMigrateCommand 참조)"
ls "${PLATFORM_MIG}" 2>/dev/null | grep -q "create_moabom_saas_tenants_table" \
  || fail "create_moabom_saas_tenants_table 마이그레이션 없음"
ls "${PLATFORM_MIG}" 2>/dev/null | grep -q "add_display_columns_to_moabom_saas_tenants_table" \
  || fail "add_display_columns_to_moabom_saas_tenants_table 마이그레이션 없음"
ls "${PLATFORM_MIG}" 2>/dev/null | grep -q "create_moabom_saas_tenant_operations_table" \
  || fail "create_moabom_saas_tenant_operations_table 마이그레이션 없음"
grep -q 'TenantDeprovisioner' "${ACTIVE_SYS}/src/Saas/Deprovision/TenantDeprovisioner.php" \
  || fail "TenantDeprovisioner 미구현"
grep -q 'deleteTenantStorageRecursive' "${ACTIVE_SYS}/src/Saas/Deprovision/TenantDeprovisioner.php" \
  || fail "TenantDeprovisioner destroy 가 driver-neutral tenant storage 삭제를 사용해야 함"
grep -q 'TENANT_STORAGE_DISKS' "${ACTIVE_SYS}/src/Saas/Deprovision/TenantDeprovisioner.php" \
  || fail "TenantDeprovisioner destroy 가 tenant storage disks 전체를 정리해야 함"
grep -q 'storage_objects_deleted' "${ACTIVE_SYS}/src/Saas/Deprovision/TenantDeprovisioner.php" \
  || fail "TenantDeprovisioner destroy metrics 에 storage_objects_deleted 필요"
grep -q 'SaasTenantReapplyAppearanceDefaultsCommand' "${PROVIDER}" \
  || fail "SystemServiceProvider 에 SaasTenantReapplyAppearanceDefaultsCommand 미등록"
test -f "${ACTIVE_SYS}/database/saas/tenant-baseline-manifest.json" \
  || fail "tenant-baseline-manifest.json 없음"
grep -q "{slug}/usage" "${ACTIVE_SYS}/src/routes/api.php" \
  || fail "usage API route 없음"
grep -q "'action' => 'purge'" "${ACTIVE_SYS}/module.php" \
  || fail "module.php 에 saas purge 권한 없음"
grep -q "'action' => 'destroy'" "${ACTIVE_SYS}/module.php" \
  || fail "module.php 에 saas destroy 권한 없음"
grep -q '"version": "1.2.8"' "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  || fail "admin_saas_hospitals.json v1.2.8 미적용 (usage runtime/baseline + navigate)"
grep -q '"wait_for": \["hospitals"\]' "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  || fail "admin_saas_hospitals.json — transition_overlay.wait_for:[hospitals] 필요"
grep -q '"id": "saas_hospitals_content"' "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  || fail "admin_saas_hospitals.json — saas_hospitals_content overlay target 필요"
grep -q 'usage_db_total' "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  && fail "admin_saas_hospitals.json — usage_db_total(합계) 행 제거 필요" || true
grep -q 'table_usage' "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  || fail "admin_saas_hospitals.json — table_usage 컬럼 누락"
grep -q 'hidden lg:table-cell' "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  && fail "admin_saas_hospitals.json — usage 컬럼 hidden lg/xl 금지 (항상 표시)" || true
grep -q '"iteration"' "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  || fail "admin_saas_hospitals.json tbody 에 iteration 없음 (forEach 금지 RF-16)"
grep -q '"handler": "confirm"' "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  && fail "admin_saas_hospitals.json 에 handler confirm 사용 (RF-17 — apiCall.confirm 만 허용)" || true
grep -q 'forEach' "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json" \
  && fail "admin_saas_hospitals.json 에 forEach 사용 (RF-16 위반)" || true
grep -q "moabom:saas:platform-migrate" "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 가 platform-migrate 미호출 (idempotent 운영 적용용)"
grep -q "moabom:apps:platform-migrate" "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 가 apps platform-migrate 미호출"
grep -q "moabom:apps:migrate-to-platform" "${ROOT}/deploy/run-saas-phase-e-post-deploy.sh" \
  && fail "run-saas-phase-e-post-deploy.sh 에 migrate-to-platform 금지 (SaaS 쓰기 SSOT=platform, 배포마다 legacy 이관 시 삭제 앱 복원)"
grep -q 'display_name' "${ACTIVE_SYS}/src/Saas/TenantProvisioner.php" \
  || fail "TenantProvisioner 가 display_name 미upsert"
grep -q 'display_name' "${ACTIVE_SYS}/src/Saas/TenantRecord.php" \
  || fail "TenantRecord 에 displayName 없음"
grep -qE "Schema::connection\('moabom_platform'\)->hasColumn\('moabom_saas_tenants'" "${ACTIVE_SYS}/src/Saas/TenantProvisioner.php" \
  || fail "TenantProvisioner 가 컬럼 존재 가드 없이 display_name upsert (legacy DB 호환 손상)"
grep -q 'SaasBackfillTenantDisplayCommand' "${PROVIDER}" \
  || fail "SystemServiceProvider 에 SaasBackfillTenantDisplayCommand 미등록"
ok "platform-migrate + display columns + backfill"

echo "==> [v8-10] hospitals 목록 UI — display_name + freshent 표시 흐름"
LIST_LAYOUT="${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospitals.json"
grep -q "item.display_name" "${LIST_LAYOUT}" \
  || fail "admin_saas_hospitals.json 이 item.display_name 미사용 (업체명 컬럼 누락)"
grep -q "item.is_platform_host" "${LIST_LAYOUT}" \
  || fail "admin_saas_hospitals.json 이 is_platform_host 미사용 (platform/tenant 구분 누락)"
grep -q "_computed.hospitalsTotal === 0" "${LIST_LAYOUT}" \
  || fail "admin_saas_hospitals.json 에 빈상태 분기 없음"
grep -q "_computed.previewHost" "${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospital_create.json" \
  || fail "admin_saas_hospital_create.json 에 호스트 라이브 프리뷰 없음"
grep -q "platform.saas.packages" "${API}" \
  || fail "platform.saas.packages 라우트 미등록"
ok "hospitals 목록·생성 UX SSOT"

echo "==> [v8-22] hospitals admin i18n + post-deploy module layout sync"
HOSP_CREATE="${ACTIVE_SYS}/resources/layouts/admin/admin_saas_hospital_create.json"
LANG_KO="${ACTIVE_SYS}/resources/lang/ko.json"
SYNC_JOB="${ROOT}/deploy/run-layout-sync-job.sh"
grep -q '\$t:moabom-system\.admin\.saas\.hospitals' "${LIST_LAYOUT}" \
  || fail "admin_saas_hospitals.json — \$t:moabom-system.admin.saas.hospitals prefix 누락"
grep -q '\$t:moabom-system\.admin\.saas\.hospitals' "${HOSP_CREATE}" \
  || fail "admin_saas_hospital_create.json — \$t:moabom-system.admin.saas.hospitals prefix 누락"
if grep -q '\$t:admin\.saas\.hospitals' "${LIST_LAYOUT}" "${HOSP_CREATE}" 2>/dev/null; then
  fail "SaaS hospitals layout 에 \$t:admin.saas.* (moabom-system prefix 누락) 잔존"
fi
grep -q '"title"' "${LANG_KO}" \
  && grep -q 'admin\.saas\.hospitals\.title' "${LIST_LAYOUT}" \
  || fail "hospitals lang/layout 키 불일치"
if grep -q '"forEach"' "${LIST_LAYOUT}"; then
  fail "admin_saas_hospitals.json — forEach 금지 (iteration.item_var 사용)"
fi
grep -q '"iteration"' "${LIST_LAYOUT}" \
  && grep -q 'item_var' "${LIST_LAYOUT}" \
  || fail "admin_saas_hospitals.json — 목록 행 iteration 누락"
grep -q 'hospitals\?\.data\?\.hospitals' "${LIST_LAYOUT}" \
  || fail "admin_saas_hospitals.json — API data path hospitals.data.hospitals 누락"
grep -q 'moabom:saas:sync-module-layouts' "${SYNC_JOB}" \
  || fail "run-layout-sync-job.sh 에 moabom:saas:sync-module-layouts 없음"
grep -q 'moabom:saas:sync-module-declarations' "${SYNC_JOB}" \
  || fail "run-layout-sync-job.sh 에 moabom:saas:sync-module-declarations 없음"
grep -q 'SaasSyncModuleDeclarationsCommand' "${APP}/modules/moabom-system/src/Providers/SystemServiceProvider.php" \
  || fail "SystemServiceProvider 에 SaasSyncModuleDeclarationsCommand 미등록"
ADMIN_MENUS="${APP}/modules/moabom-system/src/Extension/MoabomSystemAdminMenus.php"
MENU_POLICY="${APP}/modules/moabom-system/src/Saas/TenantAdminMenuPolicy.php"
grep -q 'forTenantHost' "${ADMIN_MENUS}" \
  || fail "MoabomSystemAdminMenus::forTenantHost 없음"
grep -q "'slug' => 'moabom-tenant-settings'" "${ADMIN_MENUS}" \
  && fail "MoabomSystemAdminMenus — tenant 사이드바에 moabom-tenant-settings 선언 금지"
grep -q 'moabom-tenant-settings' "${MENU_POLICY}" \
  || fail "TenantAdminMenuPolicy DEPRECATED 에 moabom-tenant-settings 없음"
LEGAL_API="${APP}/modules/moabom-system/src/routes/api.php"
TENANT_LAYOUT="${APP}/modules/moabom-system/resources/layouts/admin/admin_tenant_settings.json"
[[ ! -f "${TENANT_LAYOUT}" ]] \
  || fail "admin_tenant_settings.json 제거됨 — 업체 운영 전용 레이아웃 금지"
[[ -f "${APP}/modules/moabom-system/src/routes/legacy-tenant-settings-compat.php" ]] \
  || fail "legacy-tenant-settings-compat.php 없음 (DB 레이아웃 전환기)"
grep -q 'SaasSyncModuleLayoutsCommand' "${APP}/modules/moabom-system/src/Providers/SystemServiceProvider.php" \
  || fail "SaasSyncModuleLayoutsCommand 미등록"
grep -q 'categoryRevisionStamp' "${APP}/modules/moabom-system/src/Saas/MoabomDbConfigRepository.php" \
  || fail "MoabomDbConfigRepository — DB revision 캐시 키 없음"
grep -q 'RestrictTenantHostPlatformAdminRoutes' "${APP}/modules/moabom-system/src/Providers/SystemServiceProvider.php" \
  || fail "RestrictTenantHostPlatformAdminRoutes 미등록"
grep -q 'public/legal-pages/{slug}' "${LEGAL_API}" \
  || fail "moabom-system public/legal-pages 라우트 없음"
grep -q 'TenantLegalPageReader' "${APP}/modules/moabom-system/src/Saas/TenantLegalPageReader.php" \
  || fail "TenantLegalPageReader 없음"
SIRSOFT_PAGE_API="${ROOT}/app/templates/moabom-basic/src/api/moabomSirsoftPageApi.ts"
grep -q 'public/legal-pages' "${SIRSOFT_PAGE_API}" \
  || fail "moabomSirsoftPageApi — legal-pages 경로 미사용"
ok "hospitals i18n prefix + layout sync pipeline"

echo "==> [v8-11] moabom-weather 플러그인 분리 (Phase 1 / DECOMPOSITION)"
WEATHER_PLUGIN="${APP}/plugins/moabom-weather"
grep -q 'forecast_days' "${WEATHER_PLUGIN}/src/Services/OpenMeteoClient.php" \
  || fail "OpenMeteoClient forecast_days 파라미터 없음"
[[ -f "${WEATHER_PLUGIN}/plugin.json" ]] \
  || fail "moabom-weather plugin.json 없음 (Weather 플러그인 미스캐폴드)"
[[ -f "${WEATHER_PLUGIN}/plugin.php" ]] \
  || fail "moabom-weather plugin.php 없음"
[[ -f "${WEATHER_PLUGIN}/composer.json" ]] \
  || fail "moabom-weather composer.json 없음"
[[ -f "${WEATHER_PLUGIN}/src/Providers/WeatherServiceProvider.php" ]] \
  || fail "moabom-weather WeatherServiceProvider 없음"
[[ -f "${WEATHER_PLUGIN}/src/routes/api.php" ]] \
  || fail "moabom-weather routes/api.php 없음"
[[ -f "${WEATHER_PLUGIN}/src/Http/Controllers/WeatherCurrentController.php" ]] \
  || fail "moabom-weather WeatherCurrentController 없음"
[[ -f "${WEATHER_PLUGIN}/src/Http/Controllers/WeatherGeolocateController.php" ]] \
  || fail "moabom-weather WeatherGeolocateController 없음"
[[ -f "${WEATHER_PLUGIN}/src/Services/WeatherCurrentService.php" ]] \
  || fail "moabom-weather WeatherCurrentService 없음"
[[ -f "${WEATHER_PLUGIN}/src/Services/IpGeolocationService.php" ]] \
  || fail "moabom-weather IpGeolocationService 없음"
[[ -f "${WEATHER_PLUGIN}/src/Services/OpenMeteoClient.php" ]] \
  || fail "moabom-weather OpenMeteoClient 없음"
[[ -f "${WEATHER_PLUGIN}/src/Exceptions/UpstreamUnavailableException.php" ]] \
  || fail "moabom-weather UpstreamUnavailableException 없음"
[[ -f "${WEATHER_PLUGIN}/config/moabom-weather.php" ]] \
  || fail "moabom-weather config/moabom-weather.php 없음"
[[ -f "${WEATHER_PLUGIN}/lang/ko/messages.php" ]] \
  || fail "moabom-weather lang/ko/messages.php 없음"

# 활성 moabom-system 에서 Weather 자산이 완전히 비워졌는지
if [[ -e "${ACTIVE_SYS}/src/Services/Weather" ]]; then
  fail "활성 moabom-system 에 src/Services/Weather/ 가 남아 있음 (분리 미완)"
fi
if [[ -e "${ACTIVE_SYS}/src/Http/Controllers/Weather" ]]; then
  fail "활성 moabom-system 에 src/Http/Controllers/Weather/ 가 남아 있음"
fi
if [[ -e "${ACTIVE_SYS}/src/Contracts/Weather" ]]; then
  fail "활성 moabom-system 에 src/Contracts/Weather/ 가 남아 있음"
fi
if [[ -e "${ACTIVE_SYS}/src/Exceptions/UpstreamUnavailableException.php" ]]; then
  fail "활성 moabom-system 에 UpstreamUnavailableException 잔존 (Weather 전용)"
fi
if grep -qE "WeatherCurrentController|WeatherGeolocateController|Services\\\\Weather|moabom-system\.weather" "${API}" 2>/dev/null; then
  fail "활성 moabom-system api.php 에 Weather 참조 잔존"
fi
if grep -qE "WeatherCurrentService|IpGeolocationService|OpenMeteoClient|Services\\\\Weather" "${PROVIDER}" 2>/dev/null; then
  fail "활성 SystemServiceProvider 에 Weather 바인딩 잔존"
fi
if grep -qE "^\s*'weather'\s*=>" "${ACTIVE_SYS}/config/moabom-system.php" 2>/dev/null; then
  fail "활성 config/moabom-system.php 에 weather 섹션 잔존"
fi
if grep -qE "^\s*'weather'\s*=>" "${ACTIVE_SYS}/src/lang/ko/messages.php" 2>/dev/null \
   || grep -qE "^\s*'weather'\s*=>" "${ACTIVE_SYS}/src/lang/en/messages.php" 2>/dev/null; then
  fail "활성 moabom-system messages.php 에 weather 키 잔존"
fi

# tenant 시드 카탈로그에 moabom-weather 가 plugins 로 등록되어 있는지
HOSPITAL_PKG="${ACTIVE_SYS}/database/saas/packages/hospital-default.json"
if [[ -f "${HOSPITAL_PKG}" ]]; then
  grep -q '"moabom-weather"' "${HOSPITAL_PKG}" \
    || fail "hospital-default.json plugins[] 에 moabom-weather 미등록"
fi
ok "moabom-weather 플러그인 분리 (Phase 1)"

echo "==> [v8-12] moabom-personalization 모듈 분리 (Phase 2 / DECOMPOSITION)"
PERSO_MOD="${APP}/modules/moabom-personalization"
[[ -f "${PERSO_MOD}/module.json" ]] \
  || fail "moabom-personalization module.json 없음 (모듈 미스캐폴드)"
[[ -f "${PERSO_MOD}/module.php" ]] \
  || fail "moabom-personalization module.php 없음"
[[ -f "${PERSO_MOD}/composer.json" ]] \
  || fail "moabom-personalization composer.json 없음"
[[ -f "${PERSO_MOD}/src/Providers/PersonalizationServiceProvider.php" ]] \
  || fail "moabom-personalization PersonalizationServiceProvider 없음"
[[ -f "${PERSO_MOD}/src/routes/api.php" ]] \
  || fail "moabom-personalization routes/api.php 없음"
[[ -f "${PERSO_MOD}/src/Http/Controllers/UserMyPageActivityController.php" ]] \
  || fail "moabom-personalization UserMyPageActivityController 없음"
[[ -f "${PERSO_MOD}/src/lang/ko/messages.php" ]] \
  || fail "moabom-personalization lang/ko/messages.php 없음"
[[ -f "${PERSO_MOD}/src/lang/en/messages.php" ]] \
  || fail "moabom-personalization lang/en/messages.php 없음"

# graceful 가드: sirsoft-board 부재 tenant 에 대한 boardTablesAvailable
# (Controller→Service→Repository 계층화 이후 가드는 Repository 로 이관 — 모듈 내 어디든 존재하면 OK)
grep -rqE "Schema::hasTable\(['\"]board_posts['\"]\)" "${PERSO_MOD}/src/Repositories" "${PERSO_MOD}/src/Http/Controllers" 2>/dev/null \
  || fail "moabom-personalization 에 board_posts 부재 가드(Schema::hasTable / boardTablesAvailable) 누락"

# module.json 에 sirsoft-board 의존 명시
grep -q '"sirsoft-board"' "${PERSO_MOD}/module.json" \
  || fail "moabom-personalization module.json 의 dependencies.modules 에 sirsoft-board 미명시"

# 활성 moabom-system 에서 MyPageActivity 자산이 완전히 비워졌는지
if [[ -e "${ACTIVE_SYS}/src/Http/Controllers/UserMyPageActivityController.php" ]]; then
  fail "활성 moabom-system 에 UserMyPageActivityController 잔존"
fi
if [[ -e "${ACTIVE_SYS}/tests/Concerns/InteractsWithSirsoftBoardForTests.php" ]]; then
  fail "활성 moabom-system 에 InteractsWithSirsoftBoardForTests 잔존 (테스트 헬퍼는 personalization 으로 이관)"
fi
# 라우트 정의 또는 컨트롤러 import 가 활성에 남아있으면 실패. 주석은 OK.
if grep -qE "UserMyPageActivityController::class|use\s+.*UserMyPageActivityController" "${API}" 2>/dev/null; then
  fail "활성 moabom-system api.php 에 UserMyPageActivityController 잔존"
fi
if grep -qE "Route::get\(\s*['\"]activities['\"]" "${API}" 2>/dev/null; then
  fail "활성 moabom-system api.php 에 activities Route 정의 잔존"
fi
if grep -qE "^\s*'mypage_activity'\s*=>" "${ACTIVE_SYS}/src/lang/ko/messages.php" 2>/dev/null \
   || grep -qE "^\s*'mypage_activity'\s*=>" "${ACTIVE_SYS}/src/lang/en/messages.php" 2>/dev/null; then
  fail "활성 moabom-system messages.php 에 mypage_activity 키 잔존"
fi

# tenant 시드 카탈로그에 moabom-personalization 등록 확인
if [[ -f "${HOSPITAL_PKG}" ]]; then
  grep -q '"moabom-personalization"' "${HOSPITAL_PKG}" \
    || fail "hospital-default.json modules[] 에 moabom-personalization 미등록"
fi
ok "moabom-personalization 모듈 분리 (Phase 2)"

echo "==> [v8-13] moabom-apps 모듈 분리 (Phase 3 / DECOMPOSITION)"
APPS_MOD="${APP}/modules/moabom-apps"
[[ -f "${APPS_MOD}/module.json" ]] \
  || fail "moabom-apps module.json 없음 (모듈 미스캐폴드)"
[[ -f "${APPS_MOD}/module.php" ]] \
  || fail "moabom-apps module.php 없음"
[[ -f "${APPS_MOD}/composer.json" ]] \
  || fail "moabom-apps composer.json 없음"
[[ -f "${APPS_MOD}/config/moabom-apps.php" ]] \
  || fail "moabom-apps config/moabom-apps.php 없음"
[[ -f "${APPS_MOD}/src/Providers/AppsServiceProvider.php" ]] \
  || fail "moabom-apps AppsServiceProvider 없음"
[[ -f "${APPS_MOD}/src/routes/api.php" ]] \
  || fail "moabom-apps routes/api.php 없음"
[[ -f "${APPS_MOD}/src/Http/Controllers/AiAppController.php" ]] \
  || fail "moabom-apps AiAppController 없음"
[[ -f "${APPS_MOD}/src/Services/AiAppService.php" ]] \
  || fail "moabom-apps AiAppService 없음"
[[ -f "${APPS_MOD}/src/Models/GeneratedApp.php" ]] \
  || fail "moabom-apps GeneratedApp 모델 없음"

# 테이블명 보존 (F1) — 모델·마이그레이션 모두 'moabom_system_generated_apps' 사용
grep -q "moabom_system_generated_apps" "${APPS_MOD}/src/Models/GeneratedApp.php" \
  || fail "GeneratedApp 모델이 'moabom_system_generated_apps' 테이블명 미보존 (F1 호환 깨짐)"
MIG_FILE=$(ls "${APPS_MOD}/database/migrations/" 2>/dev/null | grep "create_moabom_system_generated_apps_table" | head -1)
[[ -n "${MIG_FILE}" ]] \
  || fail "moabom-apps 에 create_moabom_system_generated_apps_table 마이그레이션 없음"
if [[ -n "${MIG_FILE}" ]]; then
  grep -qE "Schema::hasTable\(['\"]moabom_system_generated_apps['\"]" "${APPS_MOD}/database/migrations/${MIG_FILE}" \
    || fail "moabom-apps 마이그레이션이 Schema::hasTable 가드 미포함 (idempotent 깨짐)"
fi

# config 키 분리: AiAppService 가 'moabom-apps.ai.*' 만 참조 (moabom-system.ai 잔여 금지)
if grep -qE "config\(['\"]moabom-system\.ai" "${APPS_MOD}/src/Services/AiAppService.php" 2>/dev/null; then
  fail "moabom-apps AiAppService 가 'moabom-system.ai' 참조 (분리 후 'moabom-apps.ai' 사용해야 함)"
fi
grep -qE "config\(['\"]moabom-apps\.ai" "${APPS_MOD}/src/Services/AiAppService.php" \
  || fail "moabom-apps AiAppService 가 'moabom-apps.ai' config 키 미참조"

# 활성 moabom-system 에서 AI 자산 완전히 비워졌는지
if [[ -e "${ACTIVE_SYS}/src/Http/Controllers/Apps/AiAppController.php" ]]; then
  fail "활성 moabom-system 에 AiAppController 잔존"
fi
if [[ -e "${ACTIVE_SYS}/src/Services/Apps/AiAppService.php" ]]; then
  fail "활성 moabom-system 에 AiAppService 잔존"
fi
if [[ -e "${ACTIVE_SYS}/src/Models/Apps/GeneratedApp.php" ]]; then
  fail "활성 moabom-system 에 GeneratedApp 모델 잔존"
fi
if [[ -e "${ACTIVE_SYS}/src/Http/Requests/Apps/GenerateAiAppRequest.php" ]] \
   || [[ -e "${ACTIVE_SYS}/src/Http/Requests/Apps/StoreGeneratedAppRequest.php" ]]; then
  fail "활성 moabom-system 에 AI Request 잔존"
fi
if [[ -e "${ACTIVE_SYS}/database/migrations/2026_05_08_000001_create_moabom_system_generated_apps_table.php" ]]; then
  fail "활성 moabom-system 에 generated_apps 마이그레이션 잔존"
fi
if grep -qE "AiAppController::class|use\s+.*\\\\AiAppController" "${API}" 2>/dev/null; then
  fail "활성 moabom-system api.php 에 AiAppController 잔존"
fi
if grep -qE "Route::post\(\s*['\"]ai/generate['\"]|Route::get\(\s*['\"]generated['\"]|Route::put\(\s*['\"]generated/" "${API}" 2>/dev/null; then
  fail "활성 moabom-system api.php 에 AI/generated 라우트 정의 잔존"
fi
if grep -qE "^\s*'ai'\s*=>" "${ACTIVE_SYS}/config/moabom-system.php" 2>/dev/null; then
  fail "활성 config/moabom-system.php 에 ai 섹션 잔존"
fi
if grep -qE "^\s*'ai'\s*=>" "${ACTIVE_SYS}/src/lang/ko/messages.php" 2>/dev/null \
   || grep -qE "^\s*'ai'\s*=>" "${ACTIVE_SYS}/src/lang/en/messages.php" 2>/dev/null; then
  fail "활성 moabom-system messages.php 에 'apps.ai' 키 잔존"
fi
if grep -qE "^\s*'generated'\s*=>" "${ACTIVE_SYS}/src/lang/ko/messages.php" 2>/dev/null \
   || grep -qE "^\s*'generated'\s*=>" "${ACTIVE_SYS}/src/lang/en/messages.php" 2>/dev/null; then
  fail "활성 moabom-system messages.php 에 'apps.generated' 키 잔존"
fi

# tenant 시드 카탈로그 등록 확인
if [[ -f "${HOSPITAL_PKG}" ]]; then
  grep -q '"moabom-apps"' "${HOSPITAL_PKG}" \
    || fail "hospital-default.json modules[] 에 moabom-apps 미등록"
fi
ok "moabom-apps 모듈 분리 (Phase 3)"

echo "==> [v8-14] moabom-cpap 모듈 분리 (Phase 4 / DECOMPOSITION)"
CPAP_MOD="${APP}/modules/moabom-cpap"
[[ -f "${CPAP_MOD}/module.json" ]] \
  || fail "moabom-cpap module.json 없음 (모듈 미스캐폴드)"
[[ -f "${CPAP_MOD}/module.php" ]] \
  || fail "moabom-cpap module.php 없음"
[[ -f "${CPAP_MOD}/composer.json" ]] \
  || fail "moabom-cpap composer.json 없음"
[[ -f "${CPAP_MOD}/src/Providers/CpapServiceProvider.php" ]] \
  || fail "moabom-cpap CpapServiceProvider 없음"
[[ -f "${CPAP_MOD}/src/routes/api.php" ]] \
  || fail "moabom-cpap routes/api.php 없음"
[[ -f "${CPAP_MOD}/src/Http/Controllers/CpapMeasurementController.php" ]] \
  || fail "moabom-cpap CpapMeasurementController 없음"
[[ -f "${CPAP_MOD}/src/Http/Requests/StoreCpapMeasurementRequest.php" ]] \
  || fail "moabom-cpap StoreCpapMeasurementRequest 없음"
[[ -f "${CPAP_MOD}/src/Services/CpapMeasurementService.php" ]] \
  || fail "moabom-cpap CpapMeasurementService 없음"
[[ -f "${CPAP_MOD}/src/Models/CpapMeasurement.php" ]] \
  || fail "moabom-cpap CpapMeasurement 모델 없음"

# 테이블명 보존 (F1) — 모델·마이그레이션 모두 'moabom_system_cpap_measurements' 사용
grep -q "moabom_system_cpap_measurements" "${CPAP_MOD}/src/Models/CpapMeasurement.php" \
  || fail "CpapMeasurement 모델이 'moabom_system_cpap_measurements' 테이블명 미보존 (F1 호환 깨짐)"
CPAP_MIG_FILE=$(ls "${CPAP_MOD}/database/migrations/" 2>/dev/null | grep "create_moabom_system_cpap_measurements_table" | head -1)
[[ -n "${CPAP_MIG_FILE}" ]] \
  || fail "moabom-cpap 에 create_moabom_system_cpap_measurements_table 마이그레이션 없음"
if [[ -n "${CPAP_MIG_FILE}" ]]; then
  grep -qE "Schema::hasTable\(['\"]moabom_system_cpap_measurements['\"]" "${CPAP_MOD}/database/migrations/${CPAP_MIG_FILE}" \
    || fail "moabom-cpap 마이그레이션이 Schema::hasTable 가드 미포함 (idempotent 깨짐)"
fi

# 컨트롤러가 'moabom-cpap' 모듈 식별자로 ResponseHelper 사용 (멀티라인 호출 허용)
grep -qPzo "moduleSuccess\(\s*\n?\s*['\"]moabom-cpap['\"]" \
  "${CPAP_MOD}/src/Http/Controllers/CpapMeasurementController.php" \
  || fail "CpapMeasurementController 가 moduleSuccess('moabom-cpap', ...) 미사용"

# 활성 moabom-system 에서 CPAP 자산 완전히 비워졌는지
if [[ -e "${ACTIVE_SYS}/src/Http/Controllers/Apps/CpapMeasurementController.php" ]]; then
  fail "활성 moabom-system 에 CpapMeasurementController 잔존"
fi
if [[ -e "${ACTIVE_SYS}/src/Services/Apps/CpapMeasurementService.php" ]]; then
  fail "활성 moabom-system 에 CpapMeasurementService 잔존"
fi
if [[ -e "${ACTIVE_SYS}/src/Models/Apps/CpapMeasurement.php" ]]; then
  fail "활성 moabom-system 에 CpapMeasurement 모델 잔존"
fi
if [[ -e "${ACTIVE_SYS}/src/Http/Requests/Apps/StoreCpapMeasurementRequest.php" ]]; then
  fail "활성 moabom-system 에 StoreCpapMeasurementRequest 잔존"
fi
if [[ -e "${ACTIVE_SYS}/database/migrations/2026_05_08_000002_create_moabom_system_cpap_measurements_table.php" ]]; then
  fail "활성 moabom-system 에 cpap_measurements 마이그레이션 잔존"
fi
if grep -qE "CpapMeasurementController::class|use\s+.*\\\\CpapMeasurementController" "${API}" 2>/dev/null; then
  fail "활성 moabom-system api.php 에 CpapMeasurementController 잔존"
fi
if grep -qE "Route::(get|post)\(\s*['\"]cpap-mask/" "${API}" 2>/dev/null; then
  fail "활성 moabom-system api.php 에 cpap-mask/* 라우트 정의 잔존"
fi
if grep -qE "^\s*'cpap'\s*=>" "${ACTIVE_SYS}/src/lang/ko/messages.php" 2>/dev/null \
   || grep -qE "^\s*'cpap'\s*=>" "${ACTIVE_SYS}/src/lang/en/messages.php" 2>/dev/null; then
  fail "활성 moabom-system messages.php 에 'apps.cpap' 키 잔존"
fi

# tenant 시드 카탈로그 등록 확인
if [[ -f "${HOSPITAL_PKG}" ]]; then
  grep -q '"moabom-cpap"' "${HOSPITAL_PKG}" \
    || fail "hospital-default.json modules[] 에 moabom-cpap 미등록"
fi

# 프런트엔드 — moabomAppsApi.ts 의 CPAP 호출이 moabom-cpap 로 전환
APPS_TS="${APP}/templates/moabom-basic/src/api/moabomAppsApi.ts"
if [[ -f "${APPS_TS}" ]]; then
  grep -q "requestMoabomCpapApi" "${APPS_TS}" \
    || fail "moabomAppsApi.ts 가 requestMoabomCpapApi 미사용 (CPAP 경로 미전환)"
  if grep -qE "requestMoabomSystemApi.*apps/cpap-mask" "${APPS_TS}" 2>/dev/null; then
    fail "moabomAppsApi.ts 에 CPAP 호출이 여전히 moabom-system 사용 (전환 미완)"
  fi
fi
ok "moabom-cpap 모듈 분리 (Phase 4)"

echo "==> [v8-15] 분리된 모듈·플러그인 기본 ON (DECOMPOSITION default-active 보장)"
# 신규 tenant 프로비저닝 시 자동 ON 되도록 hospital-default.json 의 modules[]·plugins[] 등록 일관성 + sync 보강.
# 활성화는 TenantDatabaseCloner 가 platform DB 의 modules/plugins 행(status=active)을 통째 복제하여 보장.
DECOMP_MODULES=("moabom-personalization" "moabom-apps" "moabom-cpap")
DECOMP_PLUGIN="moabom-weather"
if [[ -f "${HOSPITAL_PKG}" ]]; then
  for mid in "${DECOMP_MODULES[@]}"; do
    grep -q "\"${mid}\"" "${HOSPITAL_PKG}" \
      || fail "hospital-default.json modules[] 에 ${mid} 미등록 (신규 tenant 기본 OFF 위험)"
    # 권한·메뉴 sync 안전망: post_bootstrap_artisan.module_sync_declarations 에도 포함
    if ! python3 -c "import json,sys; d=json.load(open('${HOSPITAL_PKG}')); sys.exit(0 if '${mid}' in (d.get('post_bootstrap_artisan') or {}).get('module_sync_declarations',[]) else 1)" 2>/dev/null; then
      fail "hospital-default.json post_bootstrap_artisan.module_sync_declarations 에 ${mid} 미등록"
    fi
  done
  grep -q "\"${DECOMP_PLUGIN}\"" "${HOSPITAL_PKG}" \
    || fail "hospital-default.json plugins[] 에 ${DECOMP_PLUGIN} 미등록 (신규 tenant 기본 OFF 위험)"
fi
ok "분리된 4개 카탈로그 기본 ON 보장 (DECOMPOSITION)"

echo "==> [v8-16] moabom-basic src/dist API prefix 계약 (Cloud Build 산출물 기준)"
# moabom-basic dist 는 Cloud Build asset stage 가 생성한다. 로컬/WSL 빌드 금지.
# pre-Cloud Build(clean checkout)에서는 dist 가 없을 수 있으므로 src 계약만 필수로 보고,
# dist 가 존재하는 경우에만 stale 산출물 회귀를 추가 검증한다.
DIST_DIR="${APP}/templates/moabom-basic/dist/js"
DIST_COMPONENTS="${DIST_DIR}/components.iife.js"
DIST_CPAP="${DIST_DIR}/moabom-shell-cpap-mask.iife.js"
DIST_CREATE="${DIST_DIR}/moabom-shell-create-app.iife.js"
WEATHER_TS="${APP}/templates/moabom-basic/src/runtime/weather/weatherApi.ts"

[[ -f "${APP}/templates/moabom-basic/vite.config.ts" ]] \
  || fail "moabom-basic vite.config.ts 없음 — Cloud Build asset stage 빌드 입력 누락"
[[ -f "${APP}/templates/moabom-basic/vite.shell-create-app.config.ts" ]] \
  || fail "moabom-basic create-app shell vite config 없음"
[[ -f "${APP}/templates/moabom-basic/scripts/build-shell-apps.cjs" ]] \
  || fail "moabom-basic shell app 빌드 스크립트 없음"
grep -q "entryFileNames: 'js/components.iife.js'" "${APP}/templates/moabom-basic/vite.config.ts" \
  || fail "moabom-basic vite output 이 dist/js/components.iife.js 계약과 다름"
grep -q "entryFileNames: 'js/moabom-shell-create-app.iife.js'" "${APP}/templates/moabom-basic/vite.shell-create-app.config.ts" \
  || fail "moabom-basic create-app shell output 계약과 다름"

if [[ ! -f "${DIST_COMPONENTS}" || ! -f "${DIST_CPAP}" || ! -f "${DIST_CREATE}" ]]; then
  echo "    info: repo dist 없음/불완전 — Cloud Build asset stage 산출 후 dist strict 검증 대상"
  ok "moabom-basic src/API 계약 (dist 검사는 Cloud Build 산출물 기준)"
else

# strict: dist 는 항상 canonical 이어야 한다. decomposition-compat(v8-18) 는 구 PWA/캐시 클라이언트
# 전용 안전망으로만 남기고, 신규 dist 빌드에는 분리 도메인의 구 moabom-system URL 이 0건이어야 한다.
# (전환기 WARN 종료 — dist 가 legacy 0건임을 확인하고 strict 승격: 2026-06-06.)
MYPAGE_TS="${APP}/templates/moabom-basic/src/components/composite/mypage/myPageApi.ts"
for dist_file in "${DIST_COMPONENTS}" "${DIST_CPAP}" "${DIST_CREATE}"; do
  base="$(basename "${dist_file}")"
  grep -q 'moabom-system/weather' "${dist_file}" 2>/dev/null \
    && fail "${base} 에 구 weather URL(moabom-system/weather) 잔존 — weatherApi.ts canonical + Cloud Build 산출물 갱신 필요"
  grep -q 'moabom-system/user/activities' "${dist_file}" 2>/dev/null \
    && fail "${base} 에 구 activities URL(moabom-system/user/activities) 잔존 — myPageApi.ts canonical + Cloud Build 산출물 갱신 필요"
  grep -qE 'moabom-system/(apps/ai|apps/generated|apps/cpap-mask)' "${dist_file}" 2>/dev/null \
    && fail "${base} 에 구 apps URL(moabom-system/apps/*) 잔존 — moabomAppsApi.ts canonical + Cloud Build 산출물 갱신 필요"
done

# strict allowlist: dist 의 moabom-system literal 엔드포인트는 "셸/사용자 시스템" 코어만 정당.
# 분리 도메인(weather/activities/apps)이 moabom-system prefix 로 (재)유입되면 fail.
# 정당 표면 SSOT = PROJECT-ARCHITECTURE-HARDENING.md Phase 5. 동적 `${...}` fetch 는 정적 해소 불가라 미검사.
python3 - "${DIST_COMPONENTS}" "${DIST_CPAP}" "${DIST_CREATE}" <<'PY' || fail "v8-16 위반 (moabom-system allowlist 밖 엔드포인트가 dist 에 존재 — 분리 도메인은 canonical 모듈로)"
import re, sys
ALLOW = ("public/", "user/settings", "home-backgrounds/")
pat = re.compile(r"/api/modules/moabom-system/([A-Za-z0-9/_-]+)")
bad = []
for f in sys.argv[1:]:
    try:
        src = open(f, encoding="utf-8").read()
    except FileNotFoundError:
        continue
    for m in pat.finditer(src):
        path = m.group(1)
        if any(path == a.rstrip("/") or path.startswith(a) for a in ALLOW):
            continue
        bad.append(f"{f.split('/')[-1]}: {path}")
if bad:
    print("ERROR: moabom-system allowlist 밖 엔드포인트(분리 도메인은 canonical 모듈로 호출):")
    for b in sorted(set(bad)):
        print("  -", b)
    sys.exit(1)
PY

# src ↔ dist 정합 (strict — src 가 canonical 인데 dist 미반영이면 fail)
if [[ -f "${MYPAGE_TS}" ]] && grep -q 'moabom-personalization/user/activities' "${MYPAGE_TS}" 2>/dev/null; then
  grep -q 'moabom-personalization' "${DIST_COMPONENTS}" 2>/dev/null \
    || fail "myPageApi.ts 는 moabom-personalization 인데 dist/components.iife.js 미반영 — Cloud Build 산출물 갱신 필요"
fi
if [[ -f "${WEATHER_TS}" ]] && grep -q 'plugins/moabom-weather' "${WEATHER_TS}" 2>/dev/null; then
  grep -q 'plugins/moabom-weather' "${DIST_COMPONENTS}" 2>/dev/null \
    || fail "weatherApi.ts 는 moabom-weather 인데 dist 미반영 — Cloud Build 산출물 갱신 필요"
fi
if [[ -f "${APPS_TS}" ]] && grep -q "requestMoabomCpapApi" "${APPS_TS}" 2>/dev/null; then
  grep -q 'moabom-cpap' "${DIST_CPAP}" 2>/dev/null \
    || fail "CPAP→moabom-cpap 전환인데 dist/cpap shell 미반영 — Cloud Build 산출물 갱신 필요"
  grep -q 'moabom-apps' "${DIST_CREATE}" 2>/dev/null \
    || fail "AI→moabom-apps 전환인데 dist/create-app shell 미반영 — Cloud Build 산출물 갱신 필요"
fi
ok "moabom-basic dist API prefix (v8-16 strict — canonical 0 legacy)"
fi

echo "==> [v8-17] 패키지 확장 bootstrap (DECOMPOSITION install+active gap)"
SYNC_CMD="${APP}/modules/moabom-system/src/Console/Commands/SaasSyncPackageExtensionsCommand.php"
[[ -f "${SYNC_CMD}" ]] \
  || fail "SaasSyncPackageExtensionsCommand.php 없음"
grep -q 'moabom:saas:sync-package-extensions' "${SYNC_CMD}" \
  || fail "SaasSyncPackageExtensionsCommand signature 누락"
grep -q 'SaasSyncPackageExtensionsCommand' "${PROVIDER}" \
  || fail "SystemServiceProvider 에 SaasSyncPackageExtensionsCommand 미등록"
grep -q 'moabom:saas:sync-package-extensions' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 moabom:saas:sync-package-extensions 호출 없음"
[[ -x "${ROOT}/deploy/saas-extension-bootstrap.sh" ]] \
  || fail "deploy/saas-extension-bootstrap.sh 없음 또는 실행 불가"
ok "패키지 확장 bootstrap (v8-17)"

echo "==> [v8-19] tenant 패키지 확장 sync (on/off 스위치 env)"
REPAIR_CMD="${APP}/modules/moabom-system/src/Console/Commands/SaasTenantRepairCommand.php"
grep -q 'insert-only' "${REPAIR_CMD}" \
  || fail "SaasTenantRepairCommand 에 --insert-only 옵션 없음"
grep -q 'TenantAdminMenuPolicy' "${REPAIR_CMD}" \
  || fail "SaasTenantRepairCommand 에 TenantAdminMenuPolicy 미사용"
MENU_POLICY="${APP}/modules/moabom-system/src/Saas/TenantAdminMenuPolicy.php"
grep -q 'moabom-saas-hospitals' "${MENU_POLICY}" \
  || fail "TenantAdminMenuPolicy FORBIDDEN_SLUGS 누락"
grep -q 'hospital-settings' "${MENU_POLICY}" \
  || fail "TenantAdminMenuPolicy DEPRECATED_SLUGS 누락"
MENU_SYNC_HELPER="${APP}/modules/moabom-system/src/Extension/MoabomExtensionMenuSyncHelper.php"
grep -q 'clearDeclarativeOrderOverride' "${MENU_SYNC_HELPER}" \
  || fail "MoabomExtensionMenuSyncHelper declarative order sync 누락"
grep -q 'DeclarativeMenuOrderGuardListener' "${APP}/modules/moabom-system/module.php" \
  || fail "DeclarativeMenuOrderGuardListener hook 미등록"
grep -q "in_array(\$column, \['order', 'user_overrides'\]" "${REPAIR_CMD}" \
  || fail "SaasTenantRepairCommand — menu repair order/user_overrides 복사 금지 누락"
LANG_MIRROR="${APP}/modules/moabom-system/src/Saas/TenantLanguagePackMirror.php"
[[ -f "${LANG_MIRROR}" ]] \
  || fail "TenantLanguagePackMirror.php 없음"
grep -q 'mirrorFromPlatformDatabase' "${LANG_MIRROR}" \
  || fail "TenantLanguagePackMirror platform mirror 누락"
grep -q 'moabom:saas:sync-tenant-language-packs' "${APP}/modules/moabom-system/src/Console/Commands/SaasSyncTenantLanguagePacksCommand.php" \
  || fail "SaasSyncTenantLanguagePacksCommand 누락"
grep -q 'sync-tenant-language-packs' "${ROOT}/deploy/run-layout-sync-job.sh" \
  || fail "run-layout-sync-job.sh 에 sync-tenant-language-packs 없음"
grep -q 'syncCoreMenus' "${APP}/modules/moabom-system/src/Saas/TenantAdminMenuSynchronizer.php" \
  || fail "TenantAdminMenuSynchronizer syncCoreMenus 누락"
grep -q 'syncPlatform' "${APP}/modules/moabom-system/src/Saas/TenantAdminMenuSynchronizer.php" \
  || fail "TenantAdminMenuSynchronizer platform sync 누락"
SYNC_TENANT_MENUS="${APP}/modules/moabom-system/src/Console/Commands/SaasSyncTenantAdminMenusCommand.php"
[[ -f "${SYNC_TENANT_MENUS}" ]] \
  || fail "SaasSyncTenantAdminMenusCommand.php 없음"
grep -q 'moabom:saas:sync-tenant-admin-menus' "${SYNC_JOB}" \
  || fail "run-layout-sync-job.sh 에 moabom:saas:sync-tenant-admin-menus 없음"
PROVISION_RUNNER="${APP}/modules/moabom-system/src/Saas/TenantProvisionArtisanRunner.php"
grep -q 'tenant-repair' "${PROVISION_RUNNER}" \
  && grep -q 'sync-tenant-admin-menus' "${PROVISION_RUNNER}" \
  || fail "TenantProvisionArtisanRunner 에 tenant-repair + sync-tenant-admin-menus 없음"
grep -q 'moabom:saas:tenant-repair' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 moabom:saas:tenant-repair 호출 없음"
grep -q 'moabom:saas:sync-tenant-admin-menus' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 moabom:saas:sync-tenant-admin-menus 호출 없음"
grep -q 'MOABOM_SYNC_TENANT_ADMIN_MENUS' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 MOABOM_SYNC_TENANT_ADMIN_MENUS 가드 없음"
grep -q 'MOABOM_SYNC_TENANT_ADMIN_MENUS' "${ROOT}/deploy/production.env.yaml" \
  || fail "production.env.yaml 에 MOABOM_SYNC_TENANT_ADMIN_MENUS 없음"

# ── B안: tenant-reconcile SSOT 정합성 (RF-18b/RF-19b 재발 방지) ──
# 흩어진 동기화(layouts/menus/language-packs)의 완결성을 "각 스크립트 grep"이 아니라
# reconcile 커맨드가 모든 하위 단계를 위임하는지 + 사용자 표면을 검증하는지로 보증한다.
RECONCILE_CMD="${APP}/modules/moabom-system/src/Console/Commands/SaasTenantReconcileCommand.php"
[[ -f "${RECONCILE_CMD}" ]] \
  || fail "SaasTenantReconcileCommand.php 없음 (B안 통합 Reconciler)"
grep -q "moabom:saas:tenant-reconcile" "${RECONCILE_CMD}" \
  || fail "SaasTenantReconcileCommand signature 누락"
for _sub in \
  'moabom:saas:sync-template-layouts' \
  'moabom:saas:sync-module-layouts' \
  'moabom:saas:sync-tenant-admin-menus' \
  'moabom:saas:sync-tenant-language-packs' \
  'template:cache-clear'
do
  grep -q "${_sub}" "${RECONCILE_CMD}" \
    || fail "tenant-reconcile 가 ${_sub} 위임 누락 (오케스트레이션 불완전)"
done
grep -q 'language-packs total' "${RECONCILE_CMD}" \
  || fail "tenant-reconcile 에 언어팩 목록 검증(verifyOne) 누락"
grep -q '/api/admin/language-packs' "${RECONCILE_CMD}" \
  || fail "tenant-reconcile 에 admin_settings 언어팩 data source 검증 누락"
grep -q 'SaasTenantReconcileCommand' "${PROVIDER}" \
  || fail "SystemServiceProvider 에 SaasTenantReconcileCommand 미등록"
grep -q 'moabom:saas:tenant-reconcile' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 tenant-reconcile 검증 패스 없음"
grep -q 'MOABOM_VERIFY_TENANT_RECONCILE' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 MOABOM_VERIFY_TENANT_RECONCILE 가드 없음"
grep -q 'moabom:saas:tenant-reconcile' "${ROOT}/deploy/run-layout-sync-job.sh" \
  || fail "run-layout-sync-job.sh 에 tenant-reconcile 검증 패스 없음"
grep -q 'moabom:saas:tenant-reconcile' "${PROVISION_RUNNER:-${APP}/modules/moabom-system/src/Saas/TenantProvisionArtisanRunner.php}" \
  || fail "TenantProvisionArtisanRunner 에 tenant-reconcile 수렴+검증 없음"
ok "tenant-reconcile SSOT (orchestration + verify + 3 call-sites)"

# ── A안: language_packs 카탈로그 read-through (platform VIEW SSOT) ──
SHARED_SCHEMA="${APP}/modules/moabom-system/src/Saas/TenantSharedLanguagePackSchema.php"
[[ -f "${SHARED_SCHEMA}" ]] \
  || fail "TenantSharedLanguagePackSchema.php 없음 (A안 read-through)"
grep -q 'CREATE OR REPLACE VIEW' "${SHARED_SCHEMA}" \
  || fail "TenantSharedLanguagePackSchema — platform VIEW 생성 누락"
grep -q 'revertToTableForTenantDb' "${SHARED_SCHEMA}" \
  || fail "TenantSharedLanguagePackSchema — 롤백(view→table) 경로 누락"
grep -q 'sharedSchema->isEnabled()' "${LANG_MIRROR}" \
  || fail "TenantLanguagePackMirror 가 shared_language_packs 분기 미적용 (mirror→view routing 누락)"
grep -q 'shared_language_packs' "${APP}/modules/moabom-system/config/moabom-system.php" \
  || fail "moabom-system config 에 saas.shared_language_packs 플래그 없음"
grep -q 'shared_language_packs' "${APP}/config/moabom-saas.php" \
  || fail "config/moabom-saas.php 에 shared_language_packs SSOT 없음"
grep -q 'SaasSetupSharedLanguagePacksCommand' "${PROVIDER}" \
  || fail "SystemServiceProvider 에 SaasSetupSharedLanguagePacksCommand 미등록"
# config:cache 후 런타임 재주입 — 누락 시 부팅 자동 view 전환이 죽는다(수동 setup 만 동작).
grep -q 'MOABOM_SAAS_SHARED_LANGUAGE_PACKS' "${APP}/modules/moabom-system/src/Saas/SaasCachedConfigBridge.php" \
  || fail "SaasCachedConfigBridge 에 shared_language_packs getenv 재주입 누락 (런타임 게이트 false 고정)"
# raw SQL 은 DB_PREFIX(g7_) 를 직접 붙여야 한다(미적용 시 g7_language_packs 미발견 → skip).
grep -q "prefix.*self::TABLE_BASE\|prefix.\+language_packs\|->getTablePrefix\|database.connections" "${SHARED_SCHEMA}" \
  || fail "TenantSharedLanguagePackSchema 가 DB_PREFIX 미적용 (g7_ 누락 시 view 전환 skip)"
ok "shared language-packs (A안 read-through VIEW + prefix + 런타임 브리지 + 롤백)"
grep -q 'MOABOM_SYNC_TENANT_EXTENSIONS' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 MOABOM_SYNC_TENANT_EXTENSIONS 가드 없음"
grep -q 'MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE 가드 없음"
grep -q 'insert-only' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh tenant sync 에 insert-only 분기 없음"
[[ -x "${ROOT}/deploy/saas-tenant-extension-sync.sh" ]] \
  || fail "deploy/saas-tenant-extension-sync.sh 없음 또는 실행 불가"
grep -q 'MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE' "${ROOT}/deploy/saas-tenant-extension-sync.sh" \
  || fail "saas-tenant-extension-sync.sh 에 MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE 분기 없음"
ok "tenant 패키지 확장 sync (v8-19)"

echo "==> [v8-20] Run PHP 확장 (system-info admin — bcmath 등)"
grep -q 'bcmath' "${ROOT}/deploy/Dockerfile" \
  || fail "deploy/Dockerfile 에 bcmath 미포함 (system-info php_extensions)"
grep -q 'pcntl' "${ROOT}/deploy/Dockerfile" \
  || fail "deploy/Dockerfile 에 pcntl 미포함 (Laravel Reverb supervisord)"
grep -q 'docker-php-ext-enable redis' "${ROOT}/deploy/Dockerfile" \
  || fail "deploy/Dockerfile 에 redis PHP 확장 미포함 (system-info optional)"
ok "Run PHP 확장 bcmath·pcntl·redis (v8-20)"

echo "==> [v8-21] admin template layout sync (filesystem → DB, memory_usage fix)"
SYNC_LAYOUT_CMD="${APP}/modules/moabom-system/src/Console/Commands/SaasSyncTemplateLayoutsCommand.php"
grep -q 'moabom:saas:sync-template-layouts' "${SYNC_LAYOUT_CMD}" \
  || fail "SaasSyncTemplateLayoutsCommand 없음"
grep -q '{slug\?' "${SYNC_LAYOUT_CMD}" \
  || fail "SaasSyncTemplateLayoutsCommand — slug optional 인자 없음 (gcloud * 전달 시 실패)"
grep -q 'TemplateManagerInterface' "${SYNC_LAYOUT_CMD}" \
  || fail "SaasSyncTemplateLayoutsCommand — TemplateManager 직접 refresh 미사용"
grep -q 'moabom:saas:sync-template-layouts' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 moabom:saas:sync-template-layouts 호출 없음"
grep -q 'MOABOM_SYNC_TEMPLATE_LAYOUTS' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 MOABOM_SYNC_TEMPLATE_LAYOUTS 가드 없음"
grep -q 'moabom:saas:sync-module-layouts' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 moabom:saas:sync-module-layouts 호출 없음"
grep -q 'MOABOM_SYNC_MODULE_LAYOUTS' "${ROOT}/deploy/cloudrun-entrypoint.sh" "${ROOT}/deploy/cloudrun-deferred-sync.sh" \
  || fail "cloudrun-entrypoint.sh 에 MOABOM_SYNC_MODULE_LAYOUTS 가드 없음"
[[ -x "${ROOT}/deploy/saas-template-layout-sync.sh" ]] \
  || fail "deploy/saas-template-layout-sync.sh 없음 또는 실행 불가"
ok "admin template + module layout sync (v8-21 / RF-14b)"

echo "==> [v8-18] decomposition API compat SSOT (전환기 — dist·PWA 구 URL)"
COMPAT_SSOT="${ROOT}/deploy/ssot/decomposition-api-compat.json"
COMPAT_ROUTES="${ACTIVE_SYS}/src/routes/decomposition-compat.php"
[[ -f "${COMPAT_SSOT}" ]] || fail "deploy/ssot/decomposition-api-compat.json 없음"
[[ -f "${COMPAT_ROUTES}" ]] || fail "moabom-system decomposition-compat.php 없음"
grep -q 'decomposition_compat' "${ACTIVE_SYS}/config/moabom-system.php" \
  || fail "moabom-system.php 에 decomposition_compat 설정 없음"
grep -q "decomposition-compat.php" "${ACTIVE_SYS}/src/routes/api.php" \
  || fail "api.php 가 decomposition-compat.php 를 require 하지 않음"
grep -q 'UserMyPageActivityController' "${COMPAT_ROUTES}" \
  || fail "decomposition-compat.php 에 user/activities 위임 없음"
grep -q 'WeatherGeolocateController' "${COMPAT_ROUTES}" \
  || fail "decomposition-compat.php 에 weather/geolocate 위임 없음"
grep -q 'CpapMeasurementController' "${COMPAT_ROUTES}" \
  || fail "decomposition-compat.php 에 cpap-mask 위임 없음"
grep -q 'AiAppController' "${COMPAT_ROUTES}" \
  || fail "decomposition-compat.php 에 apps/ai 위임 없음"
python3 - "${COMPAT_SSOT}" "${COMPAT_ROUTES}" <<'PY' || fail "v8-18 위반 (SSOT route 가 decomposition-compat.php 에 없음)"
import json, sys
ssot = json.load(open(sys.argv[1]))
routes = open(sys.argv[2]).read()
missing = []
for r in ssot.get("routes", []):
    suffix = r["legacy_suffix"].split("{")[0].rstrip("/")
    if suffix not in routes and suffix.replace("apps/", "") not in routes:
        # heuristic: path segment must appear in compat file
        key = suffix.split("/")[-1] if "/" in suffix else suffix
        if key not in routes:
            missing.append(r["legacy_suffix"])
if missing:
    print("ERROR: SSOT routes missing in decomposition-compat.php:", ", ".join(missing))
    sys.exit(1)
PY
ok "decomposition API compat (v8-18)"

# ──────────────────────────────────────────────────────────────────────────
# v9 — 아키텍처 하드닝 (deploy/PROJECT-ARCHITECTURE-HARDENING.md)
# ──────────────────────────────────────────────────────────────────────────

echo "==> [v9-saas-stub] moabom-saas 스텁 모듈 부활 금지 (C6)"
# 운영 SaaS 런타임 SSOT 는 moabom-system 이다. modules/moabom-saas 는 활성화 가능한
# 매니페스트(module.json/module.php)를 가져선 안 된다(과거 분리 Restore 잔재 스텁).
if [[ -f "${APP}/modules/moabom-saas/module.json" || -f "${APP}/modules/moabom-saas/module.php" ]]; then
  fail "modules/moabom-saas 에 module.json/module.php 존재 — 활성화 가능한 스텁 부활 (SaaS SSOT 는 moabom-system)"
fi
ok "moabom-saas 활성 스텁 없음 (SaaS SSOT = moabom-system)"

echo "==> [v9-table-prefix] 신규 모듈 테이블 명명 규약 (C7 — {module}_* / legacy allowlist)"
python3 - "${APP}" <<'PY' || fail "v9-table-prefix 위반 (신규 moabom_system_* 테이블)"
import glob, os, re, sys
app = sys.argv[1]
# F1 호환으로 moabom_system_ prefix 를 유지하는 grandfather 허용목록 (분리 전 데이터 보존).
LEGACY = {
    "moabom_system_generated_apps",   # moabom-apps
    "moabom_system_cpap_measurements", # moabom-cpap
}
violations = []
for f in glob.glob(os.path.join(app, "modules", "moabom-*", "**", "database", "migrations", "**", "*.php"), recursive=True) \
       + glob.glob(os.path.join(app, "modules", "moabom-*", "database", "migrations", "**", "*.php"), recursive=True):
    rel = os.path.relpath(f, app)
    m = re.match(r"modules/([^/]+)/", rel)
    if not m:
        continue
    module = m.group(1)
    if module == "moabom-system":
        continue  # 시스템 모듈은 moabom_system_* 소유 정당
    src = open(f, encoding="utf-8").read()
    for tbl in re.findall(r"Schema::create\(\s*'([^']+)'", src):
        if tbl.startswith("moabom_system_") and tbl not in LEGACY:
            violations.append(f"{module}: {tbl} ({rel})")
if violations:
    print("ERROR: 신규 모듈이 moabom_system_* prefix 사용 (규약: {module}_*):")
    for v in violations:
        print("  -", v)
    sys.exit(1)
print("    OK: 모듈 테이블 prefix 규약 (legacy 2건 grandfather)")
PY
ok "테이블 명명 규약 (v9-table-prefix)"

echo "==> [v9-job-tenant] 큐 잡 테넌트 전파/복원 인프라 (C1)"
QUEUE_DIR="${ACTIVE_SYS}/src/Saas/Queue"
[[ -f "${QUEUE_DIR}/TenantQueueBootstrapper.php" ]] \
  || fail "TenantQueueBootstrapper.php 없음 (큐 테넌트 전파 코어)"
[[ -f "${QUEUE_DIR}/TenantAwareJob.php" ]] \
  || fail "TenantAwareJob.php 없음 (잡 베이스)"
[[ -f "${QUEUE_DIR}/InteractsWithTenant.php" ]] \
  || fail "InteractsWithTenant.php 없음 (잡 트레이트)"
# 글로벌 메커니즘이 SystemServiceProvider 에 실제로 배선됐는지(제거 시 격리 구멍).
grep -q 'Queue::createPayloadUsing' "${PROVIDER}" \
  || fail "SystemServiceProvider 에 Queue::createPayloadUsing(테넌트 페이로드 전파) 없음"
grep -q 'JobProcessing::class' "${PROVIDER}" \
  || fail "SystemServiceProvider 에 JobProcessing 리스너(테넌트 부트스트랩) 없음"
for _ev in 'JobProcessed::class' 'JobFailed::class' 'JobExceptionOccurred::class'; do
  grep -q "${_ev}" "${PROVIDER}" \
    || fail "SystemServiceProvider 에 ${_ev} 복원 리스너 없음 (잡 종료 후 컨텍스트 누수)"
done
grep -q 'registerTenantQueuePropagation' "${PROVIDER}" \
  || fail "SystemServiceProvider boot 에 registerTenantQueuePropagation 호출/정의 없음"
# moabom 모듈/플러그인의 ShouldQueue 잡은 TenantAwareJob 상속 강제(현재 0건 — 미래 방지).
python3 - "${APP}" <<'PY' || fail "v9-job-tenant 위반 (ShouldQueue 잡이 TenantAwareJob 미상속)"
import glob, os, re, sys
app = sys.argv[1]
violations = []
roots = (
    glob.glob(os.path.join(app, "modules", "moabom-*", "src", "**", "*.php"), recursive=True)
    + glob.glob(os.path.join(app, "plugins", "moabom-*", "src", "**", "*.php"), recursive=True)
)
for f in roots:
    rel = os.path.relpath(f, app)
    base = os.path.basename(f)
    # 인프라 클래스 자체는 제외.
    if base in ("TenantAwareJob.php", "TenantQueueBootstrapper.php", "InteractsWithTenant.php"):
        continue
    src = open(f, encoding="utf-8").read()
    # ShouldQueue 를 직접 구현하는 클래스만 대상(이미 베이스 상속 시 implements 노출 안 함).
    if re.search(r"implements[^\{]*\bShouldQueue\b", src):
        if "extends TenantAwareJob" not in src:
            violations.append(rel)
if violations:
    print("ERROR: 다음 잡이 ShouldQueue 직접 구현 — TenantAwareJob 상속 필요:")
    for v in violations:
        print("  -", v)
    sys.exit(1)
print("    OK: moabom 큐 잡 TenantAwareJob 규약 (현재 직접구현 0건)")
PY
ok "큐 잡 테넌트 전파/복원 (v9-job-tenant)"

echo "==> [v9-iframe] AI 미리보기 iframe 출처 격리 + CSP (C2)"
# dedicated_host: cross-origin(apps.mek360.com) → sandbox allow-scripts allow-same-origin
_iframe_active_src="${APP}/templates/moabom-basic/src/apps"
_iframe_viewer="${_iframe_active_src}/generated/GeneratedAppViewer.tsx"
if [[ -d "${_iframe_active_src}" ]]; then
  grep -q 'resolveGeneratedAppFrameUrl' "${_iframe_viewer}" \
    || fail "GeneratedAppViewer 가 resolveGeneratedAppFrameUrl 을 사용하지 않음"
  grep -q 'generatedAppFrameSandbox' "${_iframe_viewer}" \
    || fail "GeneratedAppViewer 가 generatedAppFrameSandbox 헬퍼를 사용하지 않음"
  grep -q 'isWebsiteLinkAppType' "${_iframe_active_src}/generated/generatedAppPreviewUrl.ts" \
    || fail "generatedAppPreviewUrl.ts 에 website_link iframe 분기 없음"
  grep -q 'allow-same-origin' "${_iframe_active_src}/generated/generatedAppPreviewUrl.ts" \
    || fail "generatedAppPreviewUrl.ts 에 cross-origin allow-same-origin 분기 없음"
  while IFS= read -r _iframe_file; do
    [[ -z "${_iframe_file}" ]] && continue
    if [[ "${_iframe_file}" == "${_iframe_viewer}" ]]; then
      continue
    fi
    if grep -qE 'sandbox="[^"]*allow-same-origin' "${_iframe_file}" 2>/dev/null; then
      echo "${_iframe_file}"
      fail "AI 앱 iframe sandbox 에 allow-same-origin 잔존 (GeneratedAppViewer 외 금지)"
    fi
  done < <(grep -rl 'allow-same-origin' "${_iframe_active_src}" 2>/dev/null || true)
fi
# CSP 주입(프론트 유틸 + 백엔드 서비스).
grep -q 'Content-Security-Policy' "${APP}/templates/moabom-basic/src/apps/ai-generator/aiHtmlUtils.ts" \
  || fail "aiHtmlUtils.ts 에 CSP 메타 주입 없음 (C2 심층 방어)"
grep -q 'Content-Security-Policy' "${APP}/modules/moabom-apps/src/Services/GeneratedAppHtmlService.php" \
  || fail "GeneratedAppHtmlService 에 서버측 CSP 하드닝 없음 (C2 심층 방어)"
grep -q 'shellFrameAncestors' "${APP}/modules/moabom-apps/src/Support/GeneratedAppPreviewRouting.php" \
  || fail "GeneratedAppPreviewRouting shellFrameAncestors (테넌트 셸 frame-ancestors) 누락"
grep -q 'frame-ancestors' "${APP}/modules/moabom-apps/src/Services/GeneratedAppPreviewService.php" \
  || fail "GeneratedAppPreviewService 에 frame-ancestors HTTP CSP 없음"
grep -q 'MODE_TENANT_PATH' "${APP}/modules/moabom-apps/src/Support/GeneratedAppPreviewRouting.php" \
  || fail "GeneratedAppPreviewRouting tenant_path 레거시 모드 누락"
grep -q 'GeneratedAppHostParser' "${APP}/modules/moabom-apps/src/Support/GeneratedAppHostParser.php" \
  || fail "GeneratedAppHostParser 누락"
grep -q 'apps.mek360.com' "${APP}/modules/moabom-apps/config/moabom-apps.php" \
  || fail "moabom-apps preview standard_host 가 apps.mek360.com SSOT 아님"
_PROD_ENV="${ROOT}/deploy/production.env.yaml"
if [[ -f "${_PROD_ENV}" ]]; then
  grep -q 'apps.mek360.com' "${_PROD_ENV}" \
    || fail "production.env.yaml MOABOM_SAAS_PLATFORM_HOSTS 또는 preview host 에 apps.mek360.com 누락"
  grep -q 'MOABOM_APPS_PREVIEW_ROUTING: dedicated_host' "${_PROD_ENV}" \
    || fail "production.env.yaml MOABOM_APPS_PREVIEW_ROUTING 이 dedicated_host 가 아님"
fi
grep -q 'moabom.saas.override_host_parse' "${APP}/modules/moabom-apps/src/Providers/AppsServiceProvider.php" \
  || fail "AppsServiceProvider 에 moabom.saas.override_host_parse 훅 누락"
grep -q 'viewerCanSeePublishedHtmlOnDedicatedHost' "${APP}/modules/moabom-apps/src/Support/GeneratedAppPublishPolicy.php" \
  || fail "GeneratedAppPublishPolicy dedicated_host 게스트 HTML 정책 누락"
grep -q "sources\[\] = 'https:'" "${APP}/plugins/moabom-auth-hardening/src/Http/Middleware/SecurityHeadersMiddleware.php" \
  || fail "SecurityHeadersMiddleware frame-src 에 website_link용 https: 누락"
ok "AI iframe 출처 격리 + CSP (v9-iframe)"

echo "==> [v9-app-manifest] 앱 SDK 매니페스트 계약 + 레지스트리/shell-boot 배선 (Phase 4)"
APPS_MOD="${APP}/modules/moabom-apps"
for _f in \
  "src/Apps/AppManifest.php" \
  "src/Apps/AppRegistryInterface.php" \
  "src/Apps/AppRegistry.php" \
  "src/Console/Commands/MakeAppCommand.php"; do
  [[ -f "${APPS_MOD}/${_f}" ]] || fail "앱 SDK 코어 누락: moabom-apps/${_f}"
done
# 레지스트리 바인딩 + shell-boot apps 필터 배선(제거 시 SDK 앱이 그리드에서 사라짐).
APPS_PROVIDER="${APPS_MOD}/src/Providers/AppsServiceProvider.php"
grep -q 'AppRegistryInterface' "${APPS_PROVIDER}" \
  || fail "AppsServiceProvider 에 AppRegistryInterface 바인딩 없음"
grep -q "moabom.shell_boot.apps" "${APPS_PROVIDER}" \
  || fail "AppsServiceProvider 에 moabom.shell_boot.apps 필터 등록 없음"
SHELL_BOOT_CTRL="${ACTIVE_SYS}/src/Http/Controllers/PublicShellBootController.php"
grep -q "moabom.shell_boot.apps" "${SHELL_BOOT_CTRL}" \
  || fail "PublicShellBootController 가 moabom.shell_boot.apps 필터를 적용하지 않음 (apps[] 미출력)"
# 앱 모듈은 app.json 보유 + 필수 필드 파싱(id/name/frontend.chunk).
python3 - "${APP}" <<'PY' || fail "v9-app-manifest 위반 (app.json 누락/파싱 실패/필수 필드 부재)"
import glob, json, os, sys
app = sys.argv[1]
# 프론트 청크를 선언하는 "앱" 모듈(SHELL_APP 그리드 후보). 현재 1차 이관 대상.
EXPECTED = ["moabom-apps", "moabom-cpap"]
errors = []
for mod in EXPECTED:
    path = os.path.join(app, "modules", mod, "app.json")
    if not os.path.isfile(path):
        errors.append(f"{mod}: app.json 없음")
        continue
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        errors.append(f"{mod}: JSON 파싱 실패 ({e})")
        continue
    entries = data.get("apps") if isinstance(data.get("apps"), list) else [data]
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append(f"{mod}: 매니페스트 항목이 객체 아님")
            continue
        if not entry.get("id"):
            errors.append(f"{mod}: id 누락")
        if not entry.get("name"):
            errors.append(f"{mod}: name 누락")
        fe = entry.get("frontend")
        if not isinstance(fe, dict) or not fe.get("chunk"):
            errors.append(f"{mod}: frontend.chunk 누락")
if errors:
    print("ERROR: app.json 매니페스트 계약 위반:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("    OK: 앱 매니페스트 계약 (moabom-apps, moabom-cpap)")
PY
ok "앱 SDK 매니페스트 + 배선 (v9-app-manifest)"

echo "==> [v9-godmodule] moabom-system 갓 모듈 재성장 방지 (C4)"
# moabom-system 은 SaaS/셸 인프라 모듈이며 "앱"이 아니다 → app.json 보유 금지.
if [[ -f "${ACTIVE_SYS}/app.json" ]]; then
  fail "moabom-system 에 app.json 존재 — 앱은 전용 모듈로 분리(moabom-system 은 인프라)"
fi
# 분리 완료된 앱 도메인 클래스가 moabom-system/src 에 (재)정의되면 실패(데코mposition 회귀 방지).
# 주의: decomposition-compat.php 의 `use ...AiAppController` 등 "참조"는 정의가 아니므로 무관.
python3 - "${ACTIVE_SYS}/src" <<'PY' || fail "v9-godmodule 위반 (앱 도메인 클래스가 moabom-system 에 정의됨)"
import glob, os, re, sys
root = sys.argv[1]
# 분리된 앱 도메인: AI 앱(moabom-apps), CPAP(moabom-cpap), 앱 SDK(moabom-apps).
deny = re.compile(r"^\s*(?:final\s+|abstract\s+)?class\s+(AiApp[A-Za-z0-9_]*|[A-Za-z0-9_]*GeneratedApp[A-Za-z0-9_]*|Cpap[A-Za-z0-9_]*|AppRegistry|AppManifest)\b", re.M)
violations = []
for f in glob.glob(os.path.join(root, "**", "*.php"), recursive=True):
    src = open(f, encoding="utf-8").read()
    for m in deny.finditer(src):
        violations.append(f"{os.path.relpath(f, root)}: class {m.group(1)}")
if violations:
    print("ERROR: 앱 도메인 클래스가 moabom-system 에 정의됨 (전용 앱 모듈로 분리 유지):")
    for v in violations:
        print("  -", v)
    sys.exit(1)
print("    OK: moabom-system 에 앱 도메인 클래스 정의 0건")
PY
ok "갓 모듈 재성장 방지 (v9-godmodule)"

if [[ "${FAIL}" -ne 0 ]]; then
  echo ""
  echo "==> v8 invariant 검증 실패 — deploy/check-saas-runtime-invariants.sh"
  exit 1
fi

echo "==> v8/v9 invariant 검증 통과 (정적)"
echo "    parity: bash deploy/saas-config-cache-parity.sh"
