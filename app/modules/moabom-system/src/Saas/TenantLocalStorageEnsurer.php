<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * 로컬 filesystem driver — tenant prefix 디렉터리가 CLI(root)로 생성돼 www-data 가 읽지 못하는 문제 방지.
 *
 * Cloud Run(GCS)에서는 no-op.
 */
final class TenantLocalStorageEnsurer
{
    /** @var list<string> */
    private const STORAGE_SUFFIXES = [
        'settings',
        'modules',
        'plugins',
        'attachments',
        'public',
    ];

    public function ensure(TenantRecord $tenant): void
    {
        if (! $this->usesLocalTenantStorage()) {
            return;
        }

        $prefix = rtrim($tenant->gcsPrefix, '/');
        if ($prefix === '') {
            $prefix = 'tenants/'.$tenant->slug;
        }

        $tenantRoot = storage_path('app/'.$prefix);
        $this->ensureWritableDirectory($tenantRoot);

        foreach (self::STORAGE_SUFFIXES as $suffix) {
            $this->ensureWritableDirectory($tenantRoot.'/'.$suffix);
        }
    }

    private function usesLocalTenantStorage(): bool
    {
        $diskConfig = config('filesystems.disks.settings');

        return is_array($diskConfig) && (($diskConfig['driver'] ?? '') === 'local');
    }

    private function ensureWritableDirectory(string $path): void
    {
        if (! is_dir($path)) {
            mkdir($path, 0775, true);
        }

        if (! is_writable($path)) {
            @chmod($path, 0775);
        }

        if (! function_exists('posix_getuid') || posix_getuid() !== 0) {
            return;
        }

        $owner = (string) config('moabom-system.saas.provision.storage_owner', 'www-data');

        if ($owner !== '') {
            @chown($path, $owner);
        }
    }
}
