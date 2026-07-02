<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Models\Template;
use App\Models\TemplateLayout;
use App\Services\LayoutResolverService;
use App\Services\LayoutService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\System\Saas\ModuleLayoutSyncCatalog;
use Modules\Moabom\System\Saas\PlatformModuleLayoutReconciler;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;

/**
 * platform module layouts — DB·resolver·병합·filesystem 버전 진단 (배포 Job / 운영 트리아지용).
 */
final class DiagnosePlatformModuleLayoutsCommand extends Command
{
    protected $signature = 'moabom:diagnose:platform-module-layouts
        {--module= : 모듈 identifier; 생략·* = layout JSON 보유 활성 모듈 전체}
        {--layout= : canonical layout name (예: moabom-system.admin_realtime_vm)}';

    protected $description = 'platform module layout DB·resolve·merge·filesystem 진단';

    public function handle(
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        PlatformModuleLayoutReconciler $reconciler,
        LayoutResolverService $layoutResolver,
        LayoutService $layoutService,
    ): int {
        $platformRuntimeConfigurator->applyPlatform();

        $connection = (string) DB::connection()->getDatabaseName();
        $this->info("DB connection: {$connection}");

        $moduleOption = $this->option('module');
        if (is_array($moduleOption)) {
            $moduleOption = '*';
        }
        $moduleOption = (string) ($moduleOption ?? '*');
        if ($moduleOption === '') {
            $moduleOption = '*';
        }

        $layoutFilter = (string) ($this->option('layout') ?? '');
        $moduleIds = ModuleLayoutSyncCatalog::resolveModuleOption($moduleOption);

        $failures = 0;

        foreach ($moduleIds as $moduleId) {
            $filesystemLayouts = $reconciler->discoverFilesystemLayouts($moduleId);

            foreach ($filesystemLayouts as $layoutInfo) {
                if ($layoutFilter !== '' && $layoutInfo['canonical'] !== $layoutFilter) {
                    continue;
                }

                $failures += $this->diagnoseLayout(
                    $layoutInfo,
                    $layoutResolver,
                    $layoutService,
                );
            }
        }

        if ($layoutFilter !== '' && $failures === 0 && $moduleIds !== []) {
            $found = false;
            foreach ($moduleIds as $moduleId) {
                if (isset($reconciler->discoverFilesystemLayouts($moduleId)[$layoutFilter])) {
                    $found = true;
                    break;
                }
            }
            if (! $found) {
                $this->error("layout filter not found on filesystem: {$layoutFilter}");

                return self::FAILURE;
            }
        }

        return $failures > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @param  array{
     *     canonical: string,
     *     base_name: string,
     *     type: string,
     *     version: string,
     *     data: array<string, mixed>,
     *     path: string
     * }  $layoutInfo
     */
    private function diagnoseLayout(
        array $layoutInfo,
        LayoutResolverService $layoutResolver,
        LayoutService $layoutService,
    ): int {
        $canonical = $layoutInfo['canonical'];
        $baseName = $layoutInfo['base_name'];
        $fileVersion = $layoutInfo['version'];

        $this->newLine();
        $this->info("=== {$canonical} (filesystem v{$fileVersion}) ===");

        $template = Template::query()
            ->where('identifier', $layoutInfo['type'] === 'admin' ? 'moabom-admin_basic' : 'moabom-basic')
            ->where('type', $layoutInfo['type'])
            ->first();

        if ($template === null) {
            $this->error("  template 없음 (type={$layoutInfo['type']})");

            return 1;
        }

        $this->line("  template_id={$template->id} ({$template->identifier})");

        foreach ([$canonical, $baseName] as $name) {
            if ($name === $canonical && $baseName === $canonical) {
                continue;
            }

            $row = TemplateLayout::query()
                ->where('template_id', $template->id)
                ->where('name', $name)
                ->first();

            if ($row === null) {
                if ($name === $canonical) {
                    $this->warn("  row 없음: {$name}");
                }

                continue;
            }

            $content = is_array($row->content)
                ? $row->content
                : json_decode((string) $row->content, true);
            $version = is_array($content) ? (string) ($content['version'] ?? '?') : '?';
            $source = $row->source_type?->value ?? 'null';

            $this->line("  [{$name}] id={$row->id} source={$source} content.version={$version}");
        }

        $resolved = $layoutResolver->resolve($canonical, $template->id);
        if ($resolved === null) {
            $this->error("  resolver: {$canonical} → null");

            return 1;
        }

        $resolvedContent = is_array($resolved->content)
            ? $resolved->content
            : json_decode((string) $resolved->content, true);
        $resolvedVersion = is_array($resolvedContent)
            ? (string) ($resolvedContent['version'] ?? '?')
            : '?';

        $this->line("  resolver → id={$resolved->id} source={$resolved->source_type?->value} version={$resolvedVersion}");

        try {
            $merged = $layoutService->getLayout($template->identifier, $canonical);
            $mergedVersion = (string) ($merged['version'] ?? '?');
            $this->line("  getLayout merged version={$mergedVersion}");
        } catch (\Throwable $e) {
            $this->error('  getLayout 실패: '.$e->getMessage());

            return 1;
        }

        if (version_compare($resolvedVersion, $fileVersion, '<')) {
            $this->error("  served v{$resolvedVersion} < filesystem v{$fileVersion}");

            return 1;
        }

        $this->line('  OK');

        return 0;
    }
}
