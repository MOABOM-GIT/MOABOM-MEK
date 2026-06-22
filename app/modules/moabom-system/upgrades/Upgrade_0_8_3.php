<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;

/**
 * 셸 랭킹 등락·ingest 가드는 코드 변경만 해당. 멱등 no-op.
 */
class Upgrade_0_8_3 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
    }
}
