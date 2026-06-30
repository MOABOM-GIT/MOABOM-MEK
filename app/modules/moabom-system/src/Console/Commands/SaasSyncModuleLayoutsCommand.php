<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Models\Template;
use App\Models\TemplateLayout;
use App\Services\ModuleService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\ModuleLayoutSyncCatalog;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
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
    private const REALTIME_VM_LAYOUT_NAME = 'moabom-system.admin_realtime_vm';

    private const REALTIME_VM_MIN_VERSION = '1.0.4';

    /** @var list<string> */
    private const LEGACY_REALTIME_VM_COMPUTED = ['wsProbe', 'runtimeConfig', 'vmMetricsData'];

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
                if (! $this->refreshModule($moduleService, $moduleId, 'platform')) {
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

                if (! $this->refreshModule($moduleService, $moduleId, $tenant->slug)) {
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

            if ($moduleId === 'moabom-system' && $label === 'platform') {
                if (! $this->assertRealtimeVmLayoutSynced($label)) {
                    return false;
                }
            }

            return true;
        } catch (\Throwable $e) {
            $this->error("  [{$label}] {$e->getMessage()}");

            return false;
        }
    }

    private function assertRealtimeVmLayoutSynced(string $label): bool
    {
        $filePath = base_path('modules/moabom-system/resources/layouts/admin/admin_realtime_vm.json');
        if (! is_readable($filePath)) {
            $this->warn("  [{$label}] admin_realtime_vm.json 없음 — 검증 생략");

            return true;
        }

        $fileData = json_decode((string) file_get_contents($filePath), true);
        if (! is_array($fileData)) {
            $this->error("  [{$label}] admin_realtime_vm.json 파싱 실패");

            return false;
        }

        $fileVersion = (string) ($fileData['version'] ?? '0');

        $template = Template::query()
            ->where('identifier', 'moabom-admin_basic')
            ->where('type', 'admin')
            ->first();

        if ($template === null) {
            $this->warn("  [{$label}] moabom-admin_basic 없음 — realtime_vm 검증 생략");

            return true;
        }

        $layout = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->where('name', self::REALTIME_VM_LAYOUT_NAME)
            ->first();

        if ($layout === null) {
            $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' 레이아웃 없음');

            return false;
        }

        $dbContent = is_array($layout->content)
            ? $layout->content
            : json_decode((string) $layout->content, true);

        if (! is_array($dbContent)) {
            $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' DB content 파싱 실패');

            return false;
        }

        $dbVersion = (string) ($dbContent['version'] ?? '0');

        if (version_compare($dbVersion, self::REALTIME_VM_MIN_VERSION, '<')) {
            $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' DB v'.$dbVersion.' < min '.self::REALTIME_VM_MIN_VERSION);

            return false;
        }

        $computed = $dbContent['computed'] ?? [];
        if (is_array($computed)) {
            foreach (self::LEGACY_REALTIME_VM_COMPUTED as $legacyKey) {
                if (array_key_exists($legacyKey, $computed)) {
                    $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME." 구형 computed.{$legacyKey} 잔존");

                    return false;
                }
            }
        }

        $serialized = json_encode($dbContent, JSON_UNESCAPED_UNICODE);
        if ($serialized !== false) {
            if (str_contains($serialized, '"name": "Dl"') || str_contains($serialized, '"iteration":{"data"')) {
                $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' 구형 UI 바인딩(Dl/iteration.data) 잔존');

                return false;
            }
            if (! str_contains($serialized, '_computed.wsHttpStatus')) {
                $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' 스칼라 _computed.wsHttpStatus 바인딩 없음');

                return false;
            }
        }

        $this->line("  [{$label}] admin_realtime_vm layout OK (v{$dbVersion}, filesystem v{$fileVersion})");

        if (version_compare($dbVersion, $fileVersion, '<')) {
            $this->warn("  [{$label}] DB layout 버전이 filesystem 보다 낮음 — module:refresh-layout 이 updated=0 이면 수동 확인");
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
