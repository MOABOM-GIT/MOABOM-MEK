<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Extension\MoabomSystemAdminMenus;

/**
 * Admin 메뉴 hygiene — 금지 slug 제거·parent_slug 계층 연결만.
 *
 * order SSOT: config/core.php + MoabomSystemAdminMenus + ExtensionMenuSyncHelper sync 시점.
 */
final class TenantAdminMenuPolicy
{
    /** @var list<string> */
    public const FORBIDDEN_SLUGS = [
        'platform-saas',
        'moabom-saas-hospitals',
    ];

    /** @var list<string> */
    public const DEPRECATED_SLUGS = [
        'hospital-settings',
        'moabom-tenant-settings',
    ];

    /**
     * Platform(master) DB 에서도 제거할 폐기 slug.
     *
     * 'platform-saas' 그룹 wrapper 는 제거되었다. 병원 관리(moabom-saas-hospitals)는
     * 플랫폼 메뉴(platform-settings) 하위 자식으로만 유지한다.
     *
     * @var list<string>
     */
    public const PLATFORM_DEPRECATED_SLUGS = [
        'platform-saas',
    ];

    /**
     * @return array<string, string> child slug → parent slug
     */
    public static function parentSlugByChild(): array
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return [];
        }

        $map = [];
        foreach (MoabomSystemAdminMenus::forTenantHost() as $menu) {
            $child = $menu['slug'] ?? null;
            $parent = $menu['parent_slug'] ?? null;
            if (is_string($child) && $child !== '' && is_string($parent) && $parent !== '') {
                $map[$child] = $parent;
            }
        }

        return $map;
    }

    /**
     * @return list<string>
     */
    public static function protectedFromPrune(): array
    {
        return array_values(array_unique(array_merge(
            array_keys(self::parentSlugByChild()),
            array_values(self::parentSlugByChild()),
        )));
    }

    public function isTenantConnection(): bool
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return false;
        }

        if (! app()->bound(TenantContext::class)) {
            return false;
        }

        return ! app(TenantContext::class)->isPlatformRequest();
    }

    public function isPlatformConnection(): bool
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return false;
        }

        if (! app()->bound(TenantContext::class)) {
            return false;
        }

        return app(TenantContext::class)->isPlatformRequest();
    }

    /**
     * @return array{purged: int, linked: int, missing_parent: list<string>, missing_child: list<string>}
     */
    public function applyHygiene(): array
    {
        if (! Schema::hasTable('menus')) {
            return $this->emptyHygieneResult();
        }

        $isPlatform = $this->isPlatformConnection();
        $isTenant = $this->isTenantConnection();

        if (! $isPlatform && ! $isTenant) {
            return $this->emptyHygieneResult();
        }

        $purged = $isTenant
            ? $this->purgeSlugs(array_merge(self::FORBIDDEN_SLUGS, self::DEPRECATED_SLUGS))
            : $this->purgeSlugs(self::PLATFORM_DEPRECATED_SLUGS);

        $reconcile = $this->reconcileParents();

        return [
            'purged' => $purged,
            'linked' => $reconcile['linked'],
            'missing_parent' => $reconcile['missing_parent'],
            'missing_child' => $reconcile['missing_child'],
        ];
    }

    /**
     * @param  list<string>  $slugs
     */
    public function purgeSlugs(array $slugs): int
    {
        if ($slugs === []) {
            return 0;
        }

        $ids = DB::table('menus')->whereIn('slug', $slugs)->pluck('id')->all();
        if ($ids === []) {
            return 0;
        }

        if (Schema::hasTable('role_menus')) {
            DB::table('role_menus')->whereIn('menu_id', $ids)->delete();
        }

        $children = DB::table('menus')->whereIn('parent_id', $ids)->pluck('id')->all();
        if ($children !== []) {
            if (Schema::hasTable('role_menus')) {
                DB::table('role_menus')->whereIn('menu_id', $children)->delete();
            }
            DB::table('menus')->whereIn('id', $children)->delete();
        }

        DB::table('menus')->whereIn('id', $ids)->delete();

        return count($ids);
    }

    /**
     * @return array{linked: int, missing_parent: list<string>, missing_child: list<string>}
     */
    public function reconcileParents(): array
    {
        $linked = 0;
        $missingParent = [];
        $missingChild = [];

        foreach (self::parentSlugByChild() as $childSlug => $parentSlug) {
            $parentId = DB::table('menus')->where('slug', $parentSlug)->value('id');
            $childId = DB::table('menus')->where('slug', $childSlug)->value('id');

            if ($parentId === null) {
                $missingParent[] = $parentSlug;

                continue;
            }

            if ($childId === null) {
                $missingChild[] = $childSlug;

                continue;
            }

            $updated = DB::table('menus')
                ->where('id', $childId)
                ->where(function ($query) use ($parentId): void {
                    $query->whereNull('parent_id')
                        ->orWhere('parent_id', '!=', $parentId);
                })
                ->update([
                    'parent_id' => $parentId,
                    'is_active' => true,
                    'updated_at' => now(),
                ]);

            if ($updated > 0) {
                $linked++;
            }
        }

        return [
            'linked' => $linked,
            'missing_parent' => $missingParent,
            'missing_child' => $missingChild,
        ];
    }

    /**
     * @return array{purged: int, linked: int, missing_parent: list<string>, missing_child: list<string>}
     */
    private function emptyHygieneResult(): array
    {
        return [
            'purged' => 0,
            'linked' => 0,
            'missing_parent' => [],
            'missing_child' => [],
        ];
    }
}
