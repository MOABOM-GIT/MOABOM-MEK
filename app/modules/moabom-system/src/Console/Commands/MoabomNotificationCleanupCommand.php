<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Services\NotificationMaintenanceService;

final class MoabomNotificationCleanupCommand extends Command
{
    protected $signature = 'moabom:notification-cleanup';

    protected $description = '사용자 알림과 관리자 발송 이력을 보관 정책에 따라 정리합니다';

    public function handle(
        NotificationMaintenanceService $maintenance,
        PlatformConnectionFactory $platformConnections,
        TenantDatabaseConfigurator $tenantDatabases,
    ): int {
        $result = $maintenance->cleanup();
        $failedTenants = [];

        if ((bool) config('moabom-system.saas.enabled', false)) {
            $platformConnections->registerConnection();
            $currentDatabase = $this->currentDatabase();
            foreach ($this->tenantDatabases() as $slug => $database) {
                if ($database === $currentDatabase) {
                    continue;
                }
                try {
                    $tenantResult = $tenantDatabases->runOnDatabase(
                        $database,
                        static fn () => $maintenance->cleanup(),
                    );
                    if (is_array($tenantResult)) {
                        foreach ($result as $key => $count) {
                            $result[$key] = $count + (int) ($tenantResult[$key] ?? 0);
                        }
                    }
                } catch (\Throwable) {
                    $failedTenants[] = $slug;
                }
            }
        }

        $this->components->info(sprintf(
            '알림 정리 완료: 읽음 %d, 미읽음 %d, 발송 이력 %d, 500건 초과 %d',
            $result['deleted_read'],
            $result['deleted_unread'],
            $result['deleted_logs'],
            $result['deleted_overflow'],
        ));

        if ($failedTenants !== []) {
            $this->components->error('알림 정리 실패 tenant: '.implode(', ', $failedTenants));

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    /**
     * @return array<string, string>
     */
    private function tenantDatabases(): array
    {
        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return [];
        }

        return DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('status', 'active')
            ->whereNotNull('db_database')
            ->orderBy('slug')
            ->pluck('db_database', 'slug')
            ->mapWithKeys(static fn ($database, $slug): array => [
                (string) $slug => (string) $database,
            ])
            ->all();
    }

    private function currentDatabase(): string
    {
        $connection = (string) config('database.default', 'mysql');

        return (string) (
            config("database.connections.{$connection}.write.database")
            ?? config("database.connections.{$connection}.database")
            ?? ''
        );
    }
}
