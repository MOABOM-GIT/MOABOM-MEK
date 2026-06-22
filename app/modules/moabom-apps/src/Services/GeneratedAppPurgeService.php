<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Repositories\GeneratedAppRepository;
use Modules\Moabom\Apps\Support\GeneratedAppAdminScope;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;
use Modules\Moabom\System\Saas\TenantRegistry;

/**
 * 생성앱 완전 삭제 SSOT — platform 행 · Hosted row/GCS · tenant AI 세션.
 */
class GeneratedAppPurgeService
{
    public function __construct(
        private readonly GeneratedAppHostingService $hostingService,
        private readonly GeneratedAppRepository $appRepository,
        private readonly TenantRegistry $tenantRegistry,
    ) {}

    public function purge(GeneratedApp $app, GeneratedAppAdminScope $scope): void
    {
        $scope->assertCanManage($app);

        $this->purgeDatastore($app);
    }

    /**
     * 생성앱 물리 삭제 SSOT — platform 행 · Hosted · tenant AI 세션 · tenant legacy apps 테이블.
     * (과거 tenant baseline 잔여 행 정리 — 신규 생성은 platform 전용)
     */
    public function purgeDatastore(GeneratedApp $app): void
    {
        $this->hostingService->teardownHosted($app);
        $this->purgeTenantSessions($app);
        $this->purgeTenantLegacyStore($app);
        $this->appRepository->delete($app);
    }

    private function purgeTenantLegacyStore(GeneratedApp $app): void
    {
        $appId = (int) $app->id;
        if ($appId <= 0) {
            return;
        }

        $slug = trim((string) ($app->tenant_slug ?? ''));
        if ($slug === '' || $slug === 'default' || $slug === 'unknown' || $slug === 'platform') {
            $this->deleteLegacyAppOnDatabase($this->mainWriteDatabaseName(), $appId);

            return;
        }

        $tenant = $this->tenantRegistry->findBySlug($slug);
        if ($tenant === null) {
            return;
        }

        $this->deleteLegacyAppOnDatabase($tenant->dbDatabase, $appId);
    }

    private function deleteLegacyAppOnDatabase(string $database, int $generatedAppId): void
    {
        if ($database === '' || $generatedAppId <= 0) {
            return;
        }

        $this->withDatabase($database, function (string $connection) use ($generatedAppId): void {
            if (Schema::connection($connection)->hasTable('moabom_generated_app_rows')) {
                DB::connection($connection)
                    ->table('moabom_generated_app_rows')
                    ->where('generated_app_id', $generatedAppId)
                    ->delete();
            }

            if (Schema::connection($connection)->hasTable('moabom_system_generated_apps')) {
                DB::connection($connection)
                    ->table('moabom_system_generated_apps')
                    ->where('id', $generatedAppId)
                    ->delete();
            }
        });
    }

    /**
     * @param  callable(string): void  $callback
     */
    private function withDatabase(string $database, callable $callback): void
    {
        $connection = (string) config('database.default', 'mysql');
        $original = config("database.connections.{$connection}");
        if (! is_array($original)) {
            return;
        }

        $config = $original;
        if (isset($config['write']) && is_array($config['write'])) {
            $config['write']['database'] = $database;
        }
        if (isset($config['read']) && is_array($config['read'])) {
            $config['read']['database'] = $database;
        }
        if (! isset($config['write'])) {
            $config['database'] = $database;
        }

        config(["database.connections.{$connection}" => $config]);
        DB::purge($connection);
        DB::reconnect($connection);

        try {
            $callback($connection);
        } finally {
            config(["database.connections.{$connection}" => $original]);
            DB::purge($connection);
            DB::reconnect($connection);
        }
    }

    private function purgeTenantSessions(GeneratedApp $app): void
    {
        $slug = trim((string) ($app->tenant_slug ?? ''));
        if ($slug === '' || $slug === 'default' || $slug === 'unknown' || $slug === 'platform') {
            $this->deleteSessionsOnDatabase($this->mainWriteDatabaseName(), (int) $app->id);

            return;
        }

        $tenant = $this->tenantRegistry->findBySlug($slug);
        if ($tenant === null) {
            return;
        }

        $this->deleteSessionsOnDatabase($tenant->dbDatabase, (int) $app->id);
    }

    private function deleteSessionsOnDatabase(string $database, int $generatedAppId): void
    {
        if ($database === '' || $generatedAppId <= 0) {
            return;
        }

        $connection = (string) config('database.default', 'mysql');
        $original = config("database.connections.{$connection}");
        if (! is_array($original)) {
            return;
        }

        $config = $original;
        if (isset($config['write']) && is_array($config['write'])) {
            $config['write']['database'] = $database;
        }
        if (isset($config['read']) && is_array($config['read'])) {
            $config['read']['database'] = $database;
        }
        if (! isset($config['write'])) {
            $config['database'] = $database;
        }

        config(["database.connections.{$connection}" => $config]);
        DB::purge($connection);
        DB::reconnect($connection);

        try {
            if (! Schema::connection($connection)->hasTable('moabom_ai_generation_sessions')) {
                return;
            }

            DB::connection($connection)
                ->table('moabom_ai_generation_sessions')
                ->where('generated_app_id', $generatedAppId)
                ->delete();
        } finally {
            config(["database.connections.{$connection}" => $original]);
            DB::purge($connection);
            DB::reconnect($connection);
        }
    }

    private function mainWriteDatabaseName(): string
    {
        $write = SaasMysqlPdoFactory::writeSlice();

        return (string) ($write['database'] ?? '');
    }
}
