<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Services\ModuleService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\ModuleLayoutSyncCatalog;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformModuleLayoutReconciler;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * 활성 모듈의 module layouts → platform·tenant DB 동기화.
 *
 * module:refresh-layout 은 Job 기본 connection(플랫폼)만 갱신해 테넌트 DB에
 * 구형 layout 잔재가 남을 수 있다. --module=* (기본) 는 admin/user layout JSON 이
 * 있는 모든 활성 모듈을 갱신한다.
 */
final class SaasSyncModuleLayoutsCommand extends Command
{
    protected $signature = 'moabom:saas:sync-module-layouts
        {slug? : 생략·* = platform + active tenants, 또는 tenant slug 1건}
        {--module= : 모듈 identifier; 생략·* = layout JSON 보유 활성 모듈 전체}
        {--skip-platform : platform DB 갱신 생략}';

    protected $description = 'module layouts → DB (platform + SaaS tenants, 기본: layout 보유 모듈 전체)';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        TenantDatabaseConfigurator $databaseConfigurator,
        ModuleService $moduleService,
        PlatformModuleLayoutReconciler $platformLayoutReconciler,
    ): int {
        $slugArg = (string) ($this->argument('slug') ?? '*');
        if ($slugArg === '' || $slugArg === 'all') {
            $slugArg = '*';
        }
        $moduleOption = $this->option('module');
        if (is_array($moduleOption)) {
            $moduleOption = '*';
        }
        $moduleOption = (string) ($moduleOption ?? '*');
        if ($moduleOption === '') {
            $moduleOption = '*';
        }
        $moduleIds = ModuleLayoutSyncCatalog::resolveModuleOption($moduleOption);
        if ($moduleIds === []) {
            $this->warn('동기화할 module layout 대상 없음 (활성 모듈 중 resources/layouts/*.json 없음)');

            return self::SUCCESS;
        }
        $skipPlatform = (bool) $this->option('skip-platform');

        $platformConnections->registerConnection();
        $platformRuntimeConfigurator->applyPlatform();

        $this->info('module layout sync targets: '.implode(', ', $moduleIds));

        $failures = 0;

        foreach ($moduleIds as $moduleId) {
            if (! $skipPlatform && ($slugArg === '*' || $slugArg === '')) {
                $this->info("=== platform (module layouts: {$moduleId}) ===");
                if (! $this->refreshModule($moduleService, $moduleId, 'platform', $platformLayoutReconciler)) {
                    $failures++;
                }
                $this->newLine();
            }

            $tenants = ($slugArg === '*' || $slugArg === '')
                ? $this->loadActiveTenants()
                : $this->loadTenants($slugArg);

            foreach ($tenants as $tenant) {
                $this->info(sprintf(
                    '=== %s / %s (host=%s db=%s) ===',
                    $tenant->slug,
                    $moduleId,
                    $tenant->host,
                    $tenant->dbDatabase,
                ));

                try {
                    $databaseConfigurator->apply($tenant);
                } catch (\Throwable $e) {
                    $this->error('  DB switch err: '.$e->getMessage());
                    $failures++;

                    continue;
                }

                if (! $this->refreshModule($moduleService, $moduleId, $tenant->slug, $platformLayoutReconciler)) {
                    $failures++;
                }

                $this->newLine();
            }
        }

        $platformRuntimeConfigurator->applyPlatform();

        if ($failures > 0) {
            $this->warn("⚠️  {$failures}개 DB module layout sync 실패");

            return self::FAILURE;
        }

        Artisan::call('template:cache-clear', [], $this->output);

        $this->info('✅ module layout sync 완료');

        return self::SUCCESS;
    }

    private function refreshModule(
        ModuleService $moduleService,
        string $moduleId,
        string $label,
        PlatformModuleLayoutReconciler $platformLayoutReconciler,
    ): bool {
        try {
            $result = $moduleService->refreshModuleLayouts($moduleId);
            if ($result === null) {
                $this->error("  [{$label}] refresh 실패 (null)");

                return false;
            }

            $this->line(sprintf(
                '  [%s] created=%d updated=%d deleted=%d',
                $label,
                (int) ($result['created'] ?? 0),
                (int) ($result['updated'] ?? 0),
                (int) ($result['deleted'] ?? 0),
            ));

            if ($label === 'platform') {
                $platformLayoutReconciler->repairModuleLayoutsFromFilesystem($moduleId);
                if (! $this->assertPlatformModuleLayoutsSynced($moduleId, $label, $platformLayoutReconciler)) {
                    return false;
                }
            }

            return true;
        } catch (\Throwable $e) {
            $this->error("  [{$label}] {$e->getMessage()}");

            return false;
        }
    }

    private function assertPlatformModuleLayoutsSynced(
        string $moduleId,
        string $label,
        PlatformModuleLayoutReconciler $reconciler,
    ): bool {
        $report = $reconciler->reconcileModuleOnPlatform($moduleId, $label);

        foreach ($report->messages as $message) {
            if (str_contains($message, 'layout OK')) {
                $this->line('  '.$message);
            } elseif (str_contains($message, '제거') || str_contains($message, '삭제') || str_contains($message, '강제 반영')) {
                $this->warn('  '.$message);
            } elseif (! str_contains($message, '검증 생략')) {
                $this->line('  '.$message);
            }
        }

        if (! $report->ok) {
            $failed = array_keys(array_filter(
                $report->layouts,
                static fn (array $entry): bool => ! $entry['ok'],
            ));
            $this->error('  ['.$label.'] '.$moduleId.' module layout reconcile 실패: '.implode(', ', $failed));

            return false;
        }

        return true;
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadActiveTenants(): array
    {
        return $this->loadTenants('*');
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadTenants(string $slugArg): array
    {
        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return [];
        }

        $query = \Illuminate\Support\Facades\DB::connection('moabom_platform')->table('moabom_saas_tenants');
        if ($slugArg !== '*' && $slugArg !== '') {
            $query->where('slug', $slugArg);
        } else {
            $query->where('status', 'active');
        }

        $rows = $query->orderBy('slug')->get();

        return $rows->map(fn ($row) => TenantRecord::fromRow((array) $row))->all();
    }
}
