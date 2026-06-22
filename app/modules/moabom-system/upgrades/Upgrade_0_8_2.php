<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;

/**
 * 셸 랭킹 캐시·집계 보정은 코드 변경만 해당. 멱등 no-op.
 */
class Upgrade_0_8_2 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
    }
}
