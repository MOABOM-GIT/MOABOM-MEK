<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Deprovision;

use Modules\Moabom\System\Saas\TenantRecord;

interface TenantDeprovisionerInterface
{
    public function purgeDbData(TenantRecord $tenant, PurgeOptions $options): PurgeResult;

    public function purgeStorageData(TenantRecord $tenant, PurgeOptions $options): PurgeResult;

    public function destroy(TenantRecord $tenant, DestroyOptions $options): DestroyResult;
}
