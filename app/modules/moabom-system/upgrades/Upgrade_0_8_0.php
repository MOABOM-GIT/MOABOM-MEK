<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;

/**
 * 셸 앱 랭킹 테이블은 마이그레이션으로 생성된다. 멱등 no-op.
 */
class Upgrade_0_8_0 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
    }
}
