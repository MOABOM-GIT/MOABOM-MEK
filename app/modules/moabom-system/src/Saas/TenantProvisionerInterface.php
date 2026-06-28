<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * 업체 테넌트 프로비저닝 계약 — Platform API·CLI·Job 공용.
 */
interface TenantProvisionerInterface
{
    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function provision(string $slug, array $input): array;
}
