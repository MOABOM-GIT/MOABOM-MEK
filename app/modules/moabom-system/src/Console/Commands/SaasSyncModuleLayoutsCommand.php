<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Enums\LayoutSourceType;
use App\Models\Template;
use App\Models\TemplateLayout;
use App\Services\LayoutResolverService;
use App\Services\LayoutService;
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
        LayoutResolverService $layoutResolver,
        LayoutService $layoutService,
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
                if (! $this->refreshModule($moduleService, $moduleId, 'platform', $layoutResolver, $layoutService)) {
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

                if (! $this->refreshModule($moduleService, $moduleId, $tenant->slug, $layoutResolver, $layoutService)) {
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

    private function refreshModule(
        ModuleService $moduleService,
        string $moduleId,
        string $label,
        LayoutResolverService $layoutResolver,
        LayoutService $layoutService,
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

            if ($moduleId === 'moabom-system') {
                $this->forceRealtimeVmModuleLayoutFromFilesystem($layoutService, $layoutResolver);
                if (! $this->assertRealtimeVmLayoutSynced($label, $layoutResolver, $layoutService)) {
                    return false;
                }
            }

            return true;
        } catch (\Throwable $e) {
            $this->error("  [{$label}] {$e->getMessage()}");

            return false;
        }
    }

    private function assertRealtimeVmLayoutSynced(
        string $label,
        LayoutResolverService $layoutResolver,
        LayoutService $layoutService,
    ): bool {
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

        $layoutExists = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->where('name', self::REALTIME_VM_LAYOUT_NAME)
            ->exists();

        if (! $layoutExists) {
            if ($label === 'platform') {
                $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' 레이아웃 없음');

                return false;
            }

            $this->line("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' 없음 — 검증 생략');

            return true;
        }

        $this->purgeOrphanRealtimeVmShortNameLayouts($template, $label, $layoutService);
        $this->purgeStaleRealtimeVmTemplateOverride($template, $label, $fileVersion, $layoutService);

        $layout = $layoutResolver->resolve(self::REALTIME_VM_LAYOUT_NAME, $template->id);

        if ($layout === null) {
            $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' resolve 실패 (레이아웃 없음)');

            return false;
        }

        if (
            $layout->source_type === LayoutSourceType::Template
            && $layout->source_identifier !== null
        ) {
            $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' — template override 가 module layout 을 가림 (purge 후에도 잔존)');

            return false;
        }

        $dbContent = is_array($layout->content)
            ? $layout->content
            : json_decode((string) $layout->content, true);

        if (! is_array($dbContent)) {
            $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME.' served content 파싱 실패');

            return false;
        }

        if (! $this->realtimeVmLayoutContentIsValid($dbContent, $fileVersion)) {
            $dbVersion = (string) ($dbContent['version'] ?? '0');
            $this->error("  [{$label}] ".self::REALTIME_VM_LAYOUT_NAME." served v{$dbVersion} — 구형 바인딩 (min ".self::REALTIME_VM_MIN_VERSION.', filesystem v'.$fileVersion.')');

            return false;
        }

        $dbVersion = (string) ($dbContent['version'] ?? '0');
        $source = $layout->source_type?->value ?? 'unknown';
        $this->line("  [{$label}] admin_realtime_vm layout OK (served v{$dbVersion} via {$source}, filesystem v{$fileVersion})");

        return true;
    }

    private function purgeStaleRealtimeVmTemplateOverride(
        Template $template,
        string $label,
        string $fileVersion,
        LayoutService $layoutService,
    ): void {
        $overrides = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->whereIn('name', [self::REALTIME_VM_LAYOUT_NAME, 'admin_realtime_vm'])
            ->fromTemplates()
            ->get();

        foreach ($overrides as $override) {
            $content = is_array($override->content)
                ? $override->content
                : json_decode((string) $override->content, true);

            if (! is_array($content) || ! $this->realtimeVmLayoutContentIsStale($content, $fileVersion)) {
                continue;
            }

            $overrideVersion = (string) ($content['version'] ?? '0');
            $layoutService->clearDependentLayoutsCache($template->id, (string) $override->name);
            $override->forceDelete();

            $this->warn("  [{$label}] stale template override 제거: {$override->name} v{$overrideVersion}");
        }
    }

    private function purgeOrphanRealtimeVmShortNameLayouts(
        Template $template,
        string $label,
        LayoutService $layoutService,
    ): void {
        $orphan = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->where('name', 'admin_realtime_vm')
            ->first();

        if ($orphan === null) {
            return;
        }

        $layoutService->clearDependentLayoutsCache($template->id, 'admin_realtime_vm');
        $layoutService->clearDependentLayoutsCache($template->id, self::REALTIME_VM_LAYOUT_NAME);
        $orphan->forceDelete();

        $this->warn("  [{$label}] orphan short-name layout 삭제: admin_realtime_vm (SSOT: ".self::REALTIME_VM_LAYOUT_NAME.')');
    }

    /**
     * @param  array<string, mixed>  $content
     */
    private function realtimeVmLayoutContentIsStale(array $content, string $fileVersion): bool
    {
        if (! $this->realtimeVmLayoutContentIsValid($content, $fileVersion)) {
            return true;
        }

        $version = (string) ($content['version'] ?? '0');

        return version_compare($version, $fileVersion, '<');
    }

    /**
     * @param  array<string, mixed>  $content
     */
    private function realtimeVmLayoutContentIsValid(array $content, string $fileVersion): bool
    {
        $version = (string) ($content['version'] ?? '0');

        if (version_compare($version, self::REALTIME_VM_MIN_VERSION, '<')) {
            return false;
        }

        $computed = $content['computed'] ?? [];
        if (is_array($computed)) {
            foreach (self::LEGACY_REALTIME_VM_COMPUTED as $legacyKey) {
                if (array_key_exists($legacyKey, $computed)) {
                    return false;
                }
            }
        }

        $serialized = json_encode($content, JSON_UNESCAPED_UNICODE);
        if ($serialized === false) {
            return false;
        }

        if (str_contains($serialized, '"name": "Dl"') || str_contains($serialized, '"iteration":{"data"')) {
            return false;
        }

        return str_contains($serialized, '_computed.wsHttpStatus');
    }

    private function readRealtimeVmFilesystemVersion(): string
    {
        $filePath = base_path('modules/moabom-system/resources/layouts/admin/admin_realtime_vm.json');
        if (! is_readable($filePath)) {
            return '0';
        }

        $fileData = json_decode((string) file_get_contents($filePath), true);

        return is_array($fileData) ? (string) ($fileData['version'] ?? '0') : '0';
    }

    private function forceRealtimeVmModuleLayoutFromFilesystem(
        LayoutService $layoutService,
        LayoutResolverService $layoutResolver,
    ): void {
        $filePath = base_path('modules/moabom-system/resources/layouts/admin/admin_realtime_vm.json');
        if (! is_readable($filePath)) {
            return;
        }

        $fileData = json_decode((string) file_get_contents($filePath), true);
        if (! is_array($fileData)) {
            return;
        }

        $fileVersion = (string) ($fileData['version'] ?? '0');

        $template = Template::query()
            ->where('identifier', 'moabom-admin_basic')
            ->where('type', 'admin')
            ->first();

        if ($template === null) {
            return;
        }

        $this->purgeOrphanRealtimeVmShortNameLayouts($template, 'platform', $layoutService);
        $this->purgeStaleRealtimeVmTemplateOverride($template, 'platform', $fileVersion, $layoutService);

        $moduleLayout = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->where('name', self::REALTIME_VM_LAYOUT_NAME)
            ->fromModules()
            ->first();

        if ($moduleLayout === null) {
            return;
        }

        $content = is_array($moduleLayout->content)
            ? $moduleLayout->content
            : json_decode((string) $moduleLayout->content, true);

        if (! is_array($content)) {
            return;
        }

        $dbVersion = (string) ($content['version'] ?? '0');

        if (
            $content === $fileData
            || (
                version_compare($dbVersion, $fileVersion, '>=')
                && $this->realtimeVmLayoutContentIsValid($content, $fileVersion)
            )
        ) {
            return;
        }

        $moduleLayout->update([
            'content' => $fileData,
            'extends' => $fileData['extends'] ?? $moduleLayout->extends,
        ]);

        $layoutService->clearDependentLayoutsCache($template->id, self::REALTIME_VM_LAYOUT_NAME);
        $layoutResolver->clearResolutionCache(self::REALTIME_VM_LAYOUT_NAME, $template->id);
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
