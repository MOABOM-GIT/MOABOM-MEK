<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\TenantAdminMenuSynchronizer;

/**
 * 플랫폼 메뉴 재구성 — 부모 order 0, 업체 관리 하위 배치, 형제 메뉴 order 정규화.
 */
class Upgrade_0_7_9 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
        if (! Schema::hasTable('menus')) {
            return;
        }

        $parentId = DB::table('menus')->where('slug', 'platform-settings')->value('id');
        if ($parentId !== null) {
            DB::table('menus')
                ->where('id', $parentId)
                ->update([
                    'name' => json_encode(['ko' => '플랫폼 메뉴', 'en' => 'Platform Menu'], JSON_UNESCAPED_UNICODE),
                    'order' => 0,
                    'parent_id' => null,
                    'updated_at' => now(),
                ]);

            DB::table('menus')
                ->where('slug', 'moabom-saas-hospitals')
                ->update([
                    'parent_id' => $parentId,
                    'order' => 10,
                    'updated_at' => now(),
                ]);
        }

        if (! config('moabom-system.saas.enabled', false)) {
            return;
        }

        $sync = app(TenantAdminMenuSynchronizer::class);
        $sync->syncPlatform();
        $sync->syncAllActiveTenants();
    }
}
