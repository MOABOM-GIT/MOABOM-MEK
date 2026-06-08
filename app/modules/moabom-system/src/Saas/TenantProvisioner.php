<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 병원 테넌트 프로비저닝 (CLI · Platform API 공용).
 */
final class TenantProvisioner implements TenantProvisionerInterface
{
    public function __construct(
        private readonly PlatformConnectionFactory $platformConnections,
        private readonly TenantDatabaseCloner $cloner,
        private readonly TenantDatabaseBootstrapper $bootstrapper,
        private readonly TenantIdentityBootstrapper $identityBootstrapper,
        private readonly TenantProvisionArtisanRunner $artisanRunner,
        private readonly TenantSettingsSeeder $settingsSeeder,
        private readonly TenantSocialAuthSettingsSeeder $socialAuthSettingsSeeder,
        private readonly TenantProvisionAppearanceDefaultsApplier $appearanceDefaultsApplier,
        private readonly TenantSiteLogoBootstrapper $siteLogoBootstrapper,
        private readonly TenantLocalStorageEnsurer $localStorageEnsurer,
        private readonly TenantRegistry $registry,
    ) {}

    /**
     * @param  array{
     *   name: string,
     *   region?: string,
     *   note?: string,
     *   address?: string,
     *   host?: string,
     *   database?: string,
     *   gcs_prefix?: string,
     *   package?: string,
     *   clone_from?: string,
     *   skip_clone?: bool,
     *   legacy_clone?: bool,
     *   force?: bool,
     * }  $input
     * @return array{
     *   slug: string,
     *   host: string,
     *   database: string,
     *   gcs_prefix: string,
     *   app_url: string,
     *   mode: string,
     *   tables_cloned: ?int,
     *   tables_bootstrapped: ?int,
     *   package_id: string,
     * }
     */
    public function provision(string $slug, array $input): array
    {
        $slug = strtolower($slug);
        if (! preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $slug)) {
            throw new \InvalidArgumentException('slug 형식 오류');
        }

        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('--name= 병원명은 필수입니다.');
        }

        $base = (string) config('moabom-system.saas.base_domain', 'mek360.com');
        $host = (string) ($input['host'] ?? "{$slug}.{$base}");
        $database = (string) ($input['database'] ?? 'hospital_'.$slug);
        $gcsPrefix = (string) ($input['gcs_prefix'] ?? 'tenants/'.$slug);
        $packageId = (string) ($input['package'] ?? 'hospital-default');
        $sourceDb = (string) ($input['clone_from']
            ?? config('moabom-system.saas.provision.schema_source_db', 'moabom-db'));
        $explicitLegacyClone = (bool) ($input['legacy_clone'] ?? false);
        $skipCloneOnly = (bool) ($input['skip_clone'] ?? false);
        $force = (bool) ($input['force'] ?? false);
        $appUrl = 'https://'.$host;

        $this->platformConnections->registerConnection();

        $existing = $this->registry->findBySlug($slug);
        if ($existing !== null && $existing->isActive() && ! $force) {
            throw new \RuntimeException("이미 active 테넌트: {$existing->host}");
        }

        $tablesCloned = null;
        $tablesBootstrapped = null;
        $mode = 'package';

        if ($explicitLegacyClone) {
            $mode = 'legacy_clone';
            $this->cloner->createDatabaseIfNotExists($database);
            $tablesCloned = $this->cloner->cloneDatabase($sourceDb, $database);
        } elseif ($skipCloneOnly) {
            $mode = 'registry_only';
            if (! $this->cloner->databaseExists($database)) {
                throw new \RuntimeException("DB {$database} 가 없습니다. (--skip-clone 는 기존 DB 가정)");
            }
        } else {
            $bootstrap = $this->bootstrapper->bootstrap($database, $sourceDb, $packageId);
            $tablesBootstrapped = $bootstrap['tables'];
        }

        $region = trim((string) ($input['note'] ?? $input['region'] ?? ''));
        $address = trim((string) ($input['address'] ?? ''));

        $tenantRecord = new TenantRecord(
            id: $existing?->id ?? 0,
            slug: $slug,
            host: $host,
            dbDatabase: $database,
            gcsPrefix: $gcsPrefix,
            packageId: $packageId,
            status: 'provisioning',
            appUrl: $appUrl,
            displayName: $name !== '' ? $name : null,
            region: $region !== '' ? $region : null,
            address: $address !== '' ? $address : null,
        );

        $adminEmail = trim((string) ($input['admin_email'] ?? config('mail.from.address', 'admin@moabom.com')));
        if ($adminEmail === '') {
            $adminEmail = 'admin@moabom.com';
        }

        if ($mode === 'package') {
            $this->identityBootstrapper->bootstrap($sourceDb, $database, $adminEmail);
            $this->artisanRunner->run($tenantRecord, $packageId);
        }

        $this->settingsSeeder->seed($tenantRecord, [
            'name' => $name,
            'region' => $region,
            'note' => $region,
            'address' => $address,
            'app_url' => $appUrl,
        ]);
        $this->socialAuthSettingsSeeder->seedFromPlatformMaster($tenantRecord);
        $this->appearanceDefaultsApplier->apply($tenantRecord);

        $this->siteLogoBootstrapper->apply(
            $tenantRecord,
            $input['logo_light'] ?? null,
            $input['logo_dark'] ?? null,
        );

        $this->localStorageEnsurer->ensure($tenantRecord);

        $now = now();
        $payload = [
            'host' => $host,
            'db_database' => $database,
            'gcs_prefix' => $gcsPrefix,
            'package_id' => $packageId,
            'status' => 'active',
            'app_url' => $appUrl,
            'updated_at' => $now,
        ];

        // 신규 컬럼은 platform 마이그레이션 적용 이후에만 채운다 (legacy 운영 안전망).
        $displayColumns = [
            'display_name' => $tenantRecord->displayName,
            'region' => $tenantRecord->region,
            'address' => $tenantRecord->address,
        ];
        foreach ($displayColumns as $column => $value) {
            if (Schema::connection('moabom_platform')->hasColumn('moabom_saas_tenants', $column)) {
                $payload[$column] = $value;
            }
        }

        $table = DB::connection('moabom_platform')->table('moabom_saas_tenants');
        if ($table->where('slug', $slug)->exists()) {
            $table->where('slug', $slug)->update($payload);
        } else {
            $table->insert(array_merge($payload, [
                'slug' => $slug,
                'created_at' => $now,
            ]));
        }

        $this->registry->forgetHostCache($host);

        return [
            'slug' => $slug,
            'host' => $host,
            'database' => $database,
            'gcs_prefix' => $gcsPrefix,
            'app_url' => $appUrl,
            'mode' => $mode,
            'tables_cloned' => $tablesCloned,
            'tables_bootstrapped' => $tablesBootstrapped,
            'package_id' => $packageId,
            'display_name' => $tenantRecord->displayName,
            'region' => $tenantRecord->region,
            'note' => $tenantRecord->note(),
            'address' => $tenantRecord->address,
        ];
    }
}
