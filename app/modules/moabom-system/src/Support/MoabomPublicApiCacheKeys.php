<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Support;

use App\Extension\HookManager;
use Modules\Moabom\System\Saas\SaasCoreSettingsHydrator;
use Modules\Moabom\System\Saas\TenantContext;
use App\Extension\ModuleManager;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;

/**
 * 공개 부트 API 캐시 키 구성 (설정·활성 모듈 변경 시 키가 달라져 TTL 전에도 무효화).
 */
final class MoabomPublicApiCacheKeys
{
    public static function activeModulesToken(): string
    {
        $ids = ModuleManager::getActiveModuleIdentifiers();
        sort($ids);

        return md5(implode(',', $ids));
    }

    public static function socialProvidersSettingsToken(): string
    {
        return (string) HookManager::applyFilters(
            'moabom.public_api.cache_fragment.social_providers',
            self::tenantScopeToken().':social:0',
        );
    }

    public static function frontendDefaults(int $revision): string
    {
        return 'moabom.public.frontend_defaults:'.self::tenantScopeToken().':'.$revision;
    }

    public static function shellBoot(string $template, string $scope, int $defaultsRevision): string
    {
        return sprintf(
            'moabom.public.shell_boot:v2:%s:%s:%s:%d:%s:%s:%s',
            self::tenantScopeToken(),
            $template,
            $scope,
            $defaultsRevision,
            self::coreSettingsRevisionToken(),
            self::socialProvidersSettingsToken(),
            self::activeModulesToken(),
        );
    }

    /**
     * shell-boot 공유 스냅샷 GCS 오브젝트 경로.
     *
     * revision 을 경로에 넣지 않고 tenant/template/scope 단위로 고정한다.
     * revision 검증은 오브젝트 내부 `cache_key` 로 수행하므로, revision·모듈 변경 시
     * 같은 경로가 덮어써져 오브젝트 개수가 (tenant × template × scope) 로 유계 유지된다.
     */
    public static function shellBootSharedObject(string $template, string $scope): string
    {
        return sprintf(
            'moabom/public-boot-cache/%s/%s/%s.json',
            self::sanitizePathSegment(self::tenantScopeToken()),
            self::sanitizePathSegment($template),
            self::sanitizePathSegment($scope),
        );
    }

    public static function shellCritical(string $template, int $extensionEpoch): string
    {
        return sprintf(
            'moabom.public.shell_critical:v1:%s:%s:%d:%s:%s',
            self::tenantScopeToken(),
            $template,
            $extensionEpoch,
            self::coreSettingsRevisionToken(),
            self::activeModulesToken(),
        );
    }

    /**
     * Blade와 shell-boot가 공유하는 config/home 스냅샷 경로.
     *
     * 변경 판정은 오브젝트 내부 cache_key가 담당하므로 경로 수는 tenant/template 단위로 제한한다.
     */
    public static function shellCriticalSharedObject(string $template): string
    {
        return sprintf(
            'moabom/public-boot-cache/%s/%s/critical.json',
            self::sanitizePathSegment(self::tenantScopeToken()),
            self::sanitizePathSegment($template),
        );
    }

    public static function shellAppsRegistry(string $template): string
    {
        return sprintf(
            'moabom.public.shell_apps_registry:v1:%s:%s:%s',
            self::tenantScopeToken(),
            $template,
            self::activeModulesToken(),
        );
    }

    private static function sanitizePathSegment(string $value): string
    {
        $clean = preg_replace('/[^A-Za-z0-9_.-]/', '_', $value) ?? '';

        return $clean !== '' ? $clean : '_';
    }

    public static function templateRoutesShell(string $template, string $scope, string $routesVersion): string
    {
        return sprintf(
            'moabom.public.template_routes_shell:%s:%s:%s:%s:%s',
            self::tenantScopeToken(),
            $template,
            $scope,
            $routesVersion,
            self::activeModulesToken(),
        );
    }

    /** templates/{id}/routes.json version 필드 또는 파일 mtime */
    public static function templateRoutesVersionToken(string $templateIdentifier): string
    {
        $path = base_path('templates/'.$templateIdentifier.'/routes.json');

        if (! File::exists($path)) {
            return 'missing';
        }

        $decoded = json_decode((string) File::get($path), true);

        if (is_array($decoded) && isset($decoded['version'])) {
            return (string) $decoded['version'];
        }

        $mtime = @filemtime($path);

        return $mtime !== false ? (string) $mtime : '0';
    }

    public static function socialProviders(): string
    {
        return 'moabom.public.social_providers:'.self::socialProvidersSettingsToken();
    }

    public static function shellAppRankings(int $limit): string
    {
        return sprintf(
            'moabom.public.shell_rankings.apps:%s:cumulative:%d',
            self::tenantScopeToken(),
            $limit,
        );
    }

    public static function shellUserRankings(int $limit): string
    {
        return sprintf(
            'moabom.public.shell_rankings.users:%s:cumulative:%d',
            self::tenantScopeToken(),
            $limit,
        );
    }

    public static function forgetShellRankings(): void
    {
        $limits = array_unique([
            min(30, max(1, (int) config('moabom-system.shell_rankings.limit', 30))),
            30,
        ]);

        foreach ($limits as $limit) {
            Cache::forget(self::shellAppRankings($limit));
            Cache::forget(self::shellUserRankings($limit));
        }
    }

    /** @deprecated 등락 비교는 기간별 rank map으로 계산 — 하위 호환 캐시 정리용 */
    public static function shellRankingsPreviousRanks(string $scope): string
    {
        return sprintf(
            'moabom.public.shell_rankings.prev.%s:%s',
            $scope,
            self::tenantScopeToken(),
        );
    }

    /** app.blade.php 홈 셸 HTML (View Composer 결과) */
    public static function appBladeHomeShell(int $extensionEpoch): string
    {
        return sprintf(
            'moabom.public.app_blade_shell:v2:%s:%d:%s:%s:%s',
            self::tenantScopeToken(),
            $extensionEpoch,
            self::coreSettingsRevisionToken(),
            self::activeModulesToken(),
            self::socialProvidersSettingsToken(),
        );
    }

    /** SaaS: platform | {tenant slug} — file 캐시 인스턴스 간 오염 방지 */
    public static function tenantScopeToken(): string
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return 'single';
        }

        try {
            $context = app(TenantContext::class);

            return $context->isPlatformRequest()
                ? 'platform'
                : ($context->tenantId() ?? 'unknown');
        } catch (\Throwable) {
            return 'unknown';
        }
    }

    /** G7 general·seo 변경 시 홈 셸 캐시 키 분리 */
    public static function coreSettingsRevisionToken(): string
    {
        try {
            return app(SaasCoreSettingsHydrator::class)->settingsRevisionToken();
        } catch (\Throwable) {
            return '0';
        }
    }
}
