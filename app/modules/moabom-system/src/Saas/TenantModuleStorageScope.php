<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Storage;

/**
 * SaaS tenant module settings(GCS modules 디스크) I/O 전 tenant prefix 재적용.
 *
 * G7 general 저장 → config:clear 후 platform prefix 로 되돌아가면
 * tenant 에 쓰고 platform 에서 읽는 split-brain 이 발생한다.
 * moabom-system module JSON read/write 직전에 본 scope 를 적용한다.
 */
final class TenantModuleStorageScope
{
    public function __construct(
        private readonly TenantFilesystemConfigurator $filesystemConfigurator,
        private readonly TenantRegistry $tenantRegistry,
    ) {}

    public function ensureApplied(): void
    {
        SaasCachedConfigBridge::applyIfNeeded();

        if (! config('moabom-system.saas.enabled', false)) {
            return;
        }

        $context = app(TenantContext::class);
        $tenant = $context->tenant();

        if ($tenant === null) {
            $host = $this->effectiveHost($context);
            if ($host !== '') {
                $tenant = $this->resolveTenantFromHost($host);
                if ($tenant !== null) {
                    $context->setTenant($tenant, $host);
                }
            }
        }

        if ($tenant === null) {
            return;
        }

        Storage::forgetDisk('modules');
        $this->filesystemConfigurator->apply($tenant);
    }

    private function effectiveHost(TenantContext $context): string
    {
        $fromContext = trim($context->requestHost());
        if ($fromContext !== '') {
            return $fromContext;
        }

        return TenantRequestHost::resolve();
    }

    private function resolveTenantFromHost(string $host): ?TenantRecord
    {
        $parsed = (new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        ))->parse($host);

        if ($parsed['type'] !== 'tenant') {
            return null;
        }

        return $this->tenantRegistry->findByHost($parsed['host']);
    }
}
