<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;

/**
 * Realtime VM 대시보드·권한은 module.php 선언으로 동기화. 멱등 no-op.
 */
class Upgrade_0_8_13 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
    }
}
