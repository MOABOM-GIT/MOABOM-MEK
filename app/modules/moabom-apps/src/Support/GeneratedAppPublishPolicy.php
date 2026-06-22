<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use Illuminate\Database\Eloquent\Builder;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Models\GeneratedApp;

/**
 * 생성앱 공개·조회 범위 SSOT.
 */
final class GeneratedAppPublishPolicy
{
    public static function visibilityOf(GeneratedApp $app): GeneratedAppVisibility
    {
        $raw = trim((string) ($app->visibility ?? ''));
        $parsed = GeneratedAppVisibility::tryFrom($raw);
        if ($parsed !== null) {
            return $parsed;
        }

        return ($app->is_shared ?? false)
            ? GeneratedAppVisibility::Global
            : GeneratedAppVisibility::Private;
    }

    public static function isPublished(GeneratedApp $app): bool
    {
        return self::visibilityOf($app)->isPublished();
    }

    public static function viewerCanSeePublished(GeneratedApp $app): bool
    {
        $visibility = self::visibilityOf($app);
        if (! $visibility->isPublished()) {
            return false;
        }

        if ($visibility === GeneratedAppVisibility::Global) {
            return true;
        }

        return self::appTenantSlug($app) === self::currentTenantSlug();
    }

    /**
     * dedicated_host 프리뷰 origin(apps / {id}.apps) — 게스트 HTML 서빙.
     * Hosted data API 는 preview_token 이 여전히 필수.
     */
    public static function viewerCanSeePublishedHtmlOnDedicatedHost(GeneratedApp $app): bool
    {
        if (! self::isPublished($app)) {
            return false;
        }

        return GeneratedAppPreviewRouting::isDedicatedPreviewHostRequest();
    }

    /**
     * @param  Builder<GeneratedApp>  $query
     */
    public static function applyPublishedCatalogScope(Builder $query): void
    {
        $slug = self::currentTenantSlug();

        $query->where(function ($inner) use ($slug): void {
            $inner->where('visibility', GeneratedAppVisibility::Global->value);

            if ($slug !== 'unknown') {
                $inner->orWhere(function ($tenant) use ($slug): void {
                    $tenant->where('visibility', GeneratedAppVisibility::Tenant->value)
                        ->where('tenant_slug', $slug);
                });
            }
        });
    }

    public static function syncLegacySharedFlag(GeneratedApp $app): void
    {
        $app->is_shared = self::visibilityOf($app)->isPublished();
    }

    private static function appTenantSlug(GeneratedApp $app): string
    {
        $slug = trim((string) ($app->tenant_slug ?? ''));

        return $slug !== '' ? $slug : 'default';
    }

    private static function currentTenantSlug(): string
    {
        return GeneratedAppPreviewRouting::tenantScopeKey();
    }
}
