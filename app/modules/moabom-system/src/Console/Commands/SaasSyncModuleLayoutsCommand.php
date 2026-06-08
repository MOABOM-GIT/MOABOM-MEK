<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Services\ModuleService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * moabom-system module layouts (admin_mypage_settings 등) → platform·tenant DB 동기화.
 *
 * module:refresh-layout 은 Job 기본 connection(플랫폼)만 갱신해 테넌트 DB에
 * 구형 admin_mypage_settings(tenant-settings endpoint) 가 남을 수 있다.
 */
final class SaasSyncModuleLayoutsCommand extends Command
{
    protected $signature = 'moabom:saas:sync-module-layouts
        {slug? : 생략·* = platform + active tenants, 또는 tenant slug 1건}
        {--module=moabom-system : 모듈 identifier}
        {--skip-platform : platform DB 갱신 생략}';

    protected $description = 'moabom-system module layouts → DB (platform + SaaS tenants)';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        TenantDatabaseConfigurator $databaseConfigurator,
        ModuleService $moduleService,
    ): int {
        $slugArg = (string) ($this->argument('slug') ?? '*');
        if ($slugArg === '' || $slugArg === 'all') {
            $slugArg = '*';
        }
        $moduleId = (string) $this->option('module');
        $skipPlatform = (bool) $this->option('skip-platform');

        $platformConnections->registerConnection();
        $platformRuntimeConfigurator->applyPlatform();

        $failures = 0;

        if (! $skipPlatform && ($slugArg === '*' || $slugArg === '')) {
            $this->info("=== platform (module layouts: {$moduleId}) ===");
            if (! $this->refreshModule($moduleService, $moduleId, 'platform')) {
                $failures++;
            }
            $this->newLine();
        }

        $tenants = ($slugArg === '*' || $slugArg === '')
            ? $this->loadActiveTenants()
            : $this->loadTenants($slugArg);

        foreach ($tenants as $tenant) {
            $this->info(sprintf('=== %s (host=%s db=%s) ===', $tenant->slug, $tenant->host, $tenant->dbDatabase));

            try {
                $databaseConfigurator->apply($tenant);
            } catch (\Throwable $e) {
                $this->error('  DB switch err: '.$e->getMessage());
                $failures++;

                continue;
            }

            if (! $this->refreshModule($moduleService, $moduleId, $tenant->slug)) {
                $failures++;
            }

            $this->newLine();
        }

        $platformRuntimeConfigurator->applyPlatform();

        if ($failures > 0) {
            $this->warn("⚠️  {$failures}개 DB module layout sync 실패");

            return self::FAILURE;
        }

        $this->info('✅ module layout sync 완료');

        return self::SUCCESS;
    }

    private function refreshModule(ModuleService $moduleService, string $moduleId, string $label): bool
    {
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

            return true;
        } catch (\Throwable $e) {
            $this->error("  [{$label}] {$e->getMessage()}");

            return false;
        }
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
