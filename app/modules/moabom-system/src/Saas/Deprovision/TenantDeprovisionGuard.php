<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Deprovision;

use Modules\Moabom\System\Saas\TenantRecord;

/**
 * deprovision/destroy 안전장치.
 */
final class TenantDeprovisionGuard
{
    public function assertPurgeAllowed(TenantRecord $tenant, PurgeOptions $options): void
    {
        $this->assertConfirmSlug($tenant, $options->confirmSlug);
        $this->assertNotPlatformHost($tenant);
        $this->assertNotProtectedSlug($tenant->slug);
        $this->assertMutableStatus($tenant);
    }

    public function assertDestroyAllowed(TenantRecord $tenant, DestroyOptions $options): void
    {
        $this->assertConfirmSlug($tenant, $options->confirmSlug);
        $this->assertConfirmHost($tenant, $options->confirmHost);
        $this->assertNotPlatformHost($tenant);
        $this->assertNotProtectedSlug($tenant->slug);
        $this->assertMutableStatus($tenant);
    }

    private function assertConfirmSlug(TenantRecord $tenant, string $confirmSlug): void
    {
        if (strtolower(trim($confirmSlug)) !== strtolower($tenant->slug)) {
            throw new \InvalidArgumentException('confirm_slug 이 일치하지 않습니다.');
        }
    }

    private function assertConfirmHost(TenantRecord $tenant, string $confirmHost): void
    {
        if (strtolower(trim($confirmHost)) !== strtolower($tenant->host)) {
            throw new \InvalidArgumentException('confirm_host 가 일치하지 않습니다.');
        }
    }

    private function assertNotPlatformHost(TenantRecord $tenant): void
    {
        $platformHosts = array_map(
            'strtolower',
            (array) config('moabom-system.saas.platform_hosts', []),
        );

        if (in_array(strtolower($tenant->host), $platformHosts, true)) {
            throw new \RuntimeException('플랫폼 호스트는 삭제할 수 없습니다.');
        }
    }

    private function assertNotProtectedSlug(string $slug): void
    {
        $protected = array_map(
            'strtolower',
            (array) config('moabom-system.saas.deprovision.protected_slugs', []),
        );

        if (in_array(strtolower($slug), $protected, true)) {
            throw new \RuntimeException("보호된 slug({$slug})는 삭제·정리할 수 없습니다.");
        }
    }

    private function assertMutableStatus(TenantRecord $tenant): void
    {
        if (in_array($tenant->status, ['provisioning', 'purging'], true)) {
            throw new \RuntimeException("현재 status={$tenant->status} — 중복 요청 불가.");
        }
    }
}
