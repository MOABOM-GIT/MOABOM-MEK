<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;

/**
 * @deprecated v0.7.4+ — declarative sync(Upgrade_0_7_2) 로 대체. 멱등 no-op.
 */
class Upgrade_0_1_5 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
        // historical one-off order patch removed — order SSOT is sync ingress only
    }
}
