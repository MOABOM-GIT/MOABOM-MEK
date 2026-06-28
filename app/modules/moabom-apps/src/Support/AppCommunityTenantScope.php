<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use Illuminate\Database\Eloquent\Builder;
use Modules\Moabom\Apps\Models\AppCommunityPost;

/**
 * 앱 이야기 작성자 tenant 격리 SSOT — GeneratedAppRepository::scopeTenant 와 동일 plane.
 */
final class AppCommunityTenantScope
{
    /** @var list<string> */
    private const MAIN_DB_AUTHOR_SLUGS = ['', 'default', 'platform', 'unknown'];

    public static function authorSlugForWrite(): string
    {
        return GeneratedAppsConnection::tenantSlugForWrite();
    }

    /**
     * 작성자 tenant 가 해석되지 않으면 리뷰 저장을 거부합니다.
     */
    public static function assertWritableAuthorTenant(): void
    {
        if (! self::shouldScopeByAuthorTenant()) {
            return;
        }

        $slug = trim(self::authorSlugForWrite());
        if ($slug === '' || $slug === 'unknown') {
            throw new \Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException(
                __('moabom-apps::messages.apps.community.author_tenant_unresolved'),
            );
        }
    }

    public static function shouldScopeByAuthorTenant(): bool
    {
        return GeneratedAppsConnection::usesPlatformStore();
    }

    public static function isMainDatabaseAuthorSlug(string $slug): bool
    {
        return in_array(trim($slug), self::MAIN_DB_AUTHOR_SLUGS, true);
    }

    /**
     * @param  Builder<AppCommunityPost>  $query
     * @return Builder<AppCommunityPost>
     */
    public static function applyAuthorTenant(Builder $query, ?string $authorTenantSlug = null): Builder
    {
        if (! self::shouldScopeByAuthorTenant()) {
            return $query;
        }

        $slug = trim((string) ($authorTenantSlug ?? self::authorSlugForWrite()));
        if ($slug === 'unknown') {
            return $query->whereRaw('1 = 0');
        }

        return $query->where('tenant_slug', $slug !== '' ? $slug : 'default');
    }

    public static function isPostAuthoredByViewer(AppCommunityPost $post, int $viewerUserId, ?string $viewerTenantSlug = null): bool
    {
        if ((int) $post->user_id !== $viewerUserId) {
            return false;
        }

        if (! self::shouldScopeByAuthorTenant()) {
            return true;
        }

        $viewerSlug = trim((string) ($viewerTenantSlug ?? self::authorSlugForWrite()));
        $postSlug = trim((string) ($post->tenant_slug ?? ''));

        return $viewerSlug !== '' && $postSlug === $viewerSlug;
    }
}
