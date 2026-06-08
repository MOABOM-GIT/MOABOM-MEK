<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\TenantAdminMenuSynchronizer;

/**
 * Declarative menu sync — G7 core + module 정의 order 를 DB 에 반영 (catalog 덮어쓰기 제거).
 */
class Upgrade_0_7_2 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
        if (! Schema::hasTable('menus') || ! config('moabom-system.saas.enabled', false)) {
            return;
        }

        app(TenantAdminMenuSynchronizer::class)->syncPlatform();
    }
}
