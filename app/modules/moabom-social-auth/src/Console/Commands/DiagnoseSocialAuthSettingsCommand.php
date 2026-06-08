<?php

declare(strict_types=1);

namespace Modules\Moabom\Social\Auth\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Modules\Moabom\Social\Auth\Models\SocialAuthSetting;
use Modules\Moabom\Social\Auth\Services\SocialAuthSettingsService;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;
use Modules\Moabom\System\Saas\TenantHostParser;
use Modules\Moabom\System\Saas\TenantRegistry;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;

/**
 * freshent 등 sub-tenant Admin SNS 빈 화면 — GCS/로컬/DB/cross-read/config 일괄 진단.
 */
class DiagnoseSocialAuthSettingsCommand extends Command
{
    protected $signature = 'moabom:social-auth:diag-settings
        {slug=freshent : 테넌트 slug}
        {--host= : HTTP Host (기본: {slug}.mek360.com)}
        {--json : JSON만 출력}';

    protected $description = 'SNS 설정 SSOT·cross-DB·GCS legacy·HTTP bootstrap 스냅샷 진단';

    public function handle(
        TenantRegistry $registry,
        TenantRuntimeBootstrap $runtimeBootstrap,
        SocialAuthSettingsService $settingsService,
    ): int {
        $slug = strtolower((string) $this->argument('slug'));
        $host = (string) ($this->option('host') ?: $slug.'.'.config('moabom-saas.base_domain', 'mek360.com'));
        $tenant = $registry->findBySlug($slug);

        $platformDb = SaasMysqlPdoFactory::platformWriteDatabase();
        $physicalTable = DB::connection()->getTablePrefix().(new SocialAuthSetting)->getTable();
        $legacyPath = storage_path('app/modules/moabom-social-auth/settings/providers.json');

        $report = [
            'cloud_run' => true,
            'host' => $host,
            'slug' => $slug,
            'tenant' => $tenant === null ? null : [
                'db' => $tenant->dbDatabase,
                'gcs_prefix' => $tenant->gcsPrefix,
                'status' => $tenant->status,
            ],
            'config' => [
                'platform_write_database' => config('moabom-saas.platform_write_database'),
                'db_write_database_env' => env('DB_WRITE_DATABASE'),
                'db_prefix' => config('database.connections.mysql.prefix'),
                'saas_enabled' => config('moabom-saas.enabled'),
                'module_settings_backend' => config('moabom-saas.module_settings_backend'),
                'filesystem_disk' => config('filesystems.default'),
            ],
            'table' => [
                'eloquent_logical' => (new SocialAuthSetting)->getTable(),
                'physical' => $physicalTable,
            ],
            'platform_db' => $this->snapshotDatabase($platformDb, $physicalTable),
            'tenant_db' => null,
            'legacy_file' => [
                'path' => $legacyPath,
                'exists' => File::exists($legacyPath),
                'size' => File::exists($legacyPath) ? File::size($legacyPath) : 0,
            ],
            'http_simulation' => null,
            'notes' => [
                'artisan_isSubTenantHost' => 'SocialAuthSettingsService::isSubTenantHost() 는 console 에서 항상 false',
                'admin_api_ssot' => 'GET /api/modules/moabom-social-auth/admin/settings (authenticated)',
            ],
        ];

        if ($tenant !== null) {
            $report['tenant_db'] = $this->snapshotDatabase($tenant->dbDatabase, $physicalTable);

            $parser = new TenantHostParser(
                (string) config('moabom-saas.base_domain', 'mek360.com'),
                (array) config('moabom-saas.platform_hosts', []),
            );
            $parsed = $parser->parse($host);
            $request = Request::create(
                'https://'.$host.'/api/modules/moabom-social-auth/admin/settings',
                'GET',
                server: ['HTTP_HOST' => $host],
            );
            $runtimeBootstrap->bootstrapTenant($request, $parsed, $tenant);
            $settingsService->clearCache();

            $providers = $settingsService->getAllSettings()['providers'] ?? [];
            $report['http_simulation'] = [
                'connection_database' => config('database.connections.mysql.database'),
                'platform_write_database_resolved' => SaasMysqlPdoFactory::platformWriteDatabase(),
                'get_platform_master_google_client_id_len' => strlen(
                    (string) $settingsService->getPlatformMasterCredential('google', 'client_id')
                ),
                'providers_google_client_id_len' => strlen((string) ($providers['google_client_id'] ?? '')),
                'providers_google_enabled' => (bool) ($providers['google_enabled'] ?? false),
            ];
        }

        if ((bool) $this->option('json')) {
            $this->line(json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        } else {
            $this->line(json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        }

        return $tenant === null ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshotDatabase(string $database, string $physicalTable): array
    {
        $snapshot = [
            'database' => $database,
            'table' => $physicalTable,
            'table_exists_information_schema' => false,
            'row_count' => null,
            'providers' => [],
            'cross_query_error' => null,
        ];

        if (! preg_match('/^[A-Za-z0-9_-]+$/', $database)) {
            $snapshot['cross_query_error'] = 'invalid database name';

            return $snapshot;
        }

        try {
            $exists = DB::selectOne(
                'SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1',
                [$database, $physicalTable],
            );
            $snapshot['table_exists_information_schema'] = $exists !== null;
        } catch (\Throwable $e) {
            $snapshot['cross_query_error'] = 'information_schema: '.$e->getMessage();

            return $snapshot;
        }

        if (! $snapshot['table_exists_information_schema']) {
            return $snapshot;
        }

        try {
            $qualified = "`{$database}`.`{$physicalTable}`";
            $rows = DB::select("SELECT provider, enabled, client_id, client_secret FROM {$qualified}");
            $snapshot['row_count'] = count($rows);
            foreach ($rows as $row) {
                $snapshot['providers'][$row->provider] = [
                    'enabled' => (bool) $row->enabled,
                    'client_id_len' => is_string($row->client_id) ? strlen($row->client_id) : 0,
                    'client_secret_len' => is_string($row->client_secret) ? strlen($row->client_secret) : 0,
                ];
            }
        } catch (\Throwable $e) {
            $snapshot['cross_query_error'] = 'select: '.$e->getMessage();
        }

        return $snapshot;
    }
}
