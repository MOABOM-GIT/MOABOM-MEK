<?php

namespace Modules\Moabom\Apps\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Config;
use Modules\Moabom\Apps\Models\AppCommunityPost;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Models\GeneratedAppRevision;
use Modules\Moabom\Apps\Models\GeneratedAppRow;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

/**
 * SaaS 생성앱 데이터 plane — platform DB (moabom_platform) + tenant_slug 격리.
 */
final class GeneratedAppsConnection
{
    public const NAME = 'moabom_platform';

    public static function register(): void
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return;
        }

        app(PlatformConnectionFactory::class)->registerConnection();
    }

    public static function usesPlatformStore(): bool
    {
        if (GeneratedAppPreviewRouting::usesTenantPath()) {
            return false;
        }

        if (! config('moabom-system.saas.enabled', false)) {
            return false;
        }

        self::register();

        return Config::has('database.connections.'.self::NAME);
    }

    /**
     * @return Builder<GeneratedApp>
     */
    public static function apps(): Builder
    {
        $connection = self::usesPlatformStore() ? self::NAME : null;

        return $connection !== null
            ? GeneratedApp::on($connection)->newQuery()
            : GeneratedApp::query();
    }

    /**
     * SaaS platform plane 쿼리를 현재 tenant로 제한합니다.
     *
     * TenantContext가 해석되지 않은 요청은 동일 user PK가 다른 tenant의 앱을
     * 노출하지 않도록 fail-closed 처리합니다.
     *
     * @param  Builder<GeneratedApp>  $query
     * @return Builder<GeneratedApp>
     */
    public static function scopeToCurrentTenant(Builder $query): Builder
    {
        if (! self::usesPlatformStore()) {
            return $query;
        }

        $slug = GeneratedAppPreviewRouting::tenantScopeKey();
        if ($slug === 'unknown') {
            return $query->whereRaw('1 = 0');
        }

        return $query->where('tenant_slug', $slug);
    }

    /**
     * @return Builder<GeneratedAppRow>
     */
    public static function rows(): Builder
    {
        $connection = self::usesPlatformStore() ? self::NAME : null;

        return $connection !== null
            ? GeneratedAppRow::on($connection)->newQuery()
            : GeneratedAppRow::query();
    }

    /**
     * @return Builder<AppCommunityPost>
     */
    public static function communityPosts(): Builder
    {
        $connection = self::usesPlatformStore() ? self::NAME : null;

        return $connection !== null
            ? AppCommunityPost::on($connection)->newQuery()
            : AppCommunityPost::query();
    }

    /**
     * @return Builder<GeneratedAppRevision>
     */
    public static function revisions(): Builder
    {
        $connection = self::usesPlatformStore() ? self::NAME : null;

        return $connection !== null
            ? GeneratedAppRevision::on($connection)->newQuery()
            : GeneratedAppRevision::query();
    }

    public static function tenantSlugForWrite(): string
    {
        return GeneratedAppPreviewRouting::tenantScopeKey();
    }
}
