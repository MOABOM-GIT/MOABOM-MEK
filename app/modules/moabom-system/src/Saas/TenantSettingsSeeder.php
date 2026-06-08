<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Storage;

/**
 * 신규 테넌트 GCS settings 시드 (general.json 등).
 */
final class TenantSettingsSeeder
{
    public function __construct(
        private readonly TenantFilesystemConfigurator $filesystemConfigurator,
    ) {}

    /**
     * @param  array{name?: string, region?: string, note?: string, address?: string, app_url?: string}  $profile
     */
    public function seed(TenantRecord $tenant, array $profile): void
    {
        $this->filesystemConfigurator->apply($tenant);
        $this->assertTenantStorageScope($tenant);

        $name = trim((string) ($profile['name'] ?? ''));
        $region = trim((string) ($profile['note'] ?? $profile['region'] ?? ''));
        $address = trim((string) ($profile['address'] ?? ''));
        $appUrl = trim((string) ($profile['app_url'] ?? $tenant->appUrl ?? 'https://'.$tenant->host));

        $descriptionParts = array_values(array_filter([$region, $address]));
        $siteDescription = $descriptionParts !== [] ? implode(' · ', $descriptionParts) : '';

        $adminEmail = trim((string) config('mail.from.address', 'admin@moabom.com'));
        if ($adminEmail === '') {
            $adminEmail = 'admin@moabom.com';
        }

        $general = [
            '_meta' => [
                'version' => '1.0.0',
                'updated_at' => now()->toIso8601String(),
            ],
            'site_name' => $name !== '' ? $name : $tenant->slug,
            'site_url' => $appUrl,
            'site_description' => $siteDescription,
            'admin_email' => $adminEmail,
            'timezone' => 'Asia/Seoul',
            'language' => 'ko',
            'currency' => 'KRW',
            'maintenance_mode' => false,
        ];

        $json = json_encode($general, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new \RuntimeException('general.json encode failed.');
        }

        if (! Storage::disk('settings')->put('general.json', $json)) {
            throw new \RuntimeException('general.json write failed.');
        }
    }

    private function assertTenantStorageScope(TenantRecord $tenant): void
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return;
        }

        $diskConfig = config('filesystems.disks.settings');
        if (! is_array($diskConfig)) {
            throw new \RuntimeException('settings disk config missing');
        }

        $needle = 'tenants/'.$tenant->slug;
        $driver = (string) ($diskConfig['driver'] ?? '');

        if ($driver === 'gcs') {
            $prefix = (string) ($diskConfig['path_prefix'] ?? '');
            if (! str_contains($prefix, $needle)) {
                throw new \RuntimeException(
                    "Tenant GCS prefix 미적용 — settings.path_prefix={$prefix}, expected *{$needle}*"
                );
            }

            return;
        }

        $root = (string) ($diskConfig['root'] ?? '');
        if (! str_contains(str_replace('\\', '/', $root), str_replace('/', DIRECTORY_SEPARATOR, $needle))) {
            throw new \RuntimeException(
                "Tenant storage root 미적용 — settings.root={$root}, expected *{$needle}*"
            );
        }
    }
}
