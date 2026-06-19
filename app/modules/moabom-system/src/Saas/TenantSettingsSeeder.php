<?php

namespace Modules\Moabom\System\Saas;

use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Broadcasting\ReverbDriversDefaults;
use Modules\Moabom\System\Models\ModuleSetting;

/**
 * 신규 테넌트 GCS settings 시드 (general.json 등).
 */
final class TenantSettingsSeeder
{
    private const G7_CORE_MODULE_KEY = '_g7_core_';

    public function __construct(
        private readonly TenantFilesystemConfigurator $filesystemConfigurator,
        private readonly ?TenantDatabaseConfigurator $databaseConfigurator = null,
    ) {}

    /**
     * @param  array{name?: string, region?: string, note?: string, address?: string, app_url?: string}  $profile
     */
    public function seed(TenantRecord $tenant, array $profile): void
    {
        $this->filesystemConfigurator->apply($tenant);
        $this->databaseConfigurator?->apply($tenant);
        $this->assertTenantStorageScope($tenant);

        $name = trim((string) ($profile['name'] ?? ''));
        $region = trim((string) ($profile['note'] ?? $profile['region'] ?? ''));
        $address = trim((string) ($profile['address'] ?? ''));
        $appUrl = trim((string) ($profile['app_url'] ?? $tenant->appUrl ?? 'https://'.$tenant->host));

        $descriptionParts = array_values(array_filter([$region, $address]));
        $siteDescription = $descriptionParts !== [] ? implode(' · ', $descriptionParts) : '';

        $adminEmail = SaasAdminCredentials::email();

        $general = [
            '_meta' => [
                'version' => '1.0.0',
                'updated_at' => now()->toIso8601String(),
            ],
            'site_name' => $name !== '' ? $name : $tenant->slug,
            'site_url' => $appUrl,
            'site_description' => $siteDescription,
            'site_note' => $region,
            'site_address' => $address,
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

        $this->upsertCoreSetting('general', $general);
        $this->syncAdminNickname((string) $general['site_name']);
        $this->seedDriversSettings($tenant);
    }

    private function seedDriversSettings(TenantRecord $tenant): void
    {
        $drivers = ReverbDriversDefaults::mergeInto([
            '_meta' => [
                'version' => '1.0.0',
                'updated_at' => now()->toIso8601String(),
            ],
            'storage_driver' => 'gcs',
        ], $tenant->host);

        $json = json_encode($drivers, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new \RuntimeException('drivers.json encode failed.');
        }

        if (! Storage::disk('settings')->put('drivers.json', $json)) {
            throw new \RuntimeException('drivers.json write failed.');
        }

        $this->upsertCoreSetting('drivers', $drivers);
    }

    /**
     * 런타임 SSOT는 DB-backed ConfigRepository이므로 GCS JSON과 같은 payload를 같이 쓴다.
     *
     * @param  array<string, mixed>  $payload
     */
    private function upsertCoreSetting(string $category, array $payload): void
    {
        ModuleSetting::query()->updateOrCreate(
            ['module' => self::G7_CORE_MODULE_KEY, 'category' => $category],
            ['payload' => $payload],
        );
    }

    private function syncAdminNickname(string $siteName): void
    {
        $nickname = trim($siteName);
        if ($nickname === '') {
            return;
        }

        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'nickname')) {
            return;
        }

        User::query()
            ->where('email', SaasAdminCredentials::DEFAULT_ADMIN_EMAIL)
            ->update([
                'nickname' => $nickname,
                'updated_at' => now(),
            ]);
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
