<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Enums\LayoutSourceType;
use App\Models\Template;
use App\Models\TemplateLayout;
use App\Repositories\TemplateRepository;
use App\Services\LayoutResolverService;
use App\Services\LayoutService;
use App\Services\ModuleService;
use Illuminate\Support\Collection;

/**
 * platform DB module layouts — filesystem SSOT 정합 (전 모듈·전 layout).
 *
 * template override·단축명 orphan 제거, module row 강제 반영, resolver 검증.
 * 배포 Job(moabom:saas:reconcile-platform-module-layouts) 및 sync-module-layouts 가 공유한다.
 */
final class PlatformModuleLayoutReconciler
{
    public function __construct(
        private readonly LayoutService $layoutService,
        private readonly LayoutResolverService $layoutResolver,
        private readonly ModuleService $moduleService,
        private readonly TemplateRepository $templateRepository,
    ) {}

    /**
     * @return array<string, array{
     *     canonical: string,
     *     base_name: string,
     *     type: string,
     *     version: string,
     *     data: array<string, mixed>,
     *     path: string
     * }>
     */
    public function discoverFilesystemLayouts(string $moduleId): array
    {
        $layouts = [];

        foreach (['admin', 'user'] as $type) {
            $dir = base_path("modules/{$moduleId}/resources/layouts/{$type}");
            if (! is_dir($dir)) {
                continue;
            }

            foreach (glob("{$dir}/*.json") ?: [] as $path) {
                if (! is_readable($path)) {
                    continue;
                }

                $data = json_decode((string) file_get_contents($path), true);
                if (! is_array($data)) {
                    continue;
                }

                $baseName = (string) ($data['layout_name'] ?? pathinfo($path, PATHINFO_FILENAME));
                $canonical = "{$moduleId}.{$baseName}";

                $layouts[$canonical] = [
                    'canonical' => $canonical,
                    'base_name' => $baseName,
                    'type' => $type,
                    'version' => (string) ($data['version'] ?? '0'),
                    'data' => $data,
                    'path' => $path,
                ];
            }
        }

        ksort($layouts);

        return $layouts;
    }

    public function reconcilePlatform(?string $moduleFilter = null, string $label = 'platform'): PlatformLayoutReconcileReport
    {
        $moduleIds = $moduleFilter !== null && $moduleFilter !== ''
            ? ModuleLayoutSyncCatalog::resolveModuleOption($moduleFilter)
            : ModuleLayoutSyncCatalog::identifiersWithFilesystemLayouts();

        $report = new PlatformLayoutReconcileReport();

        foreach ($moduleIds as $moduleId) {
            $report->merge($this->reconcileModuleOnPlatform($moduleId, $label));
        }

        if ($moduleIds === []) {
            $report->addMessage("[{$label}] reconcile 대상 module layout 없음");
        }

        return $report;
    }

    public function reconcileModuleOnPlatform(string $moduleId, string $label = 'platform'): PlatformLayoutReconcileReport
    {
        $report = new PlatformLayoutReconcileReport();
        $filesystemLayouts = $this->discoverFilesystemLayouts($moduleId);

        if ($filesystemLayouts === []) {
            $report->addMessage("[{$label}] {$moduleId} — filesystem layout 없음 (검증 생략)");

            return $report;
        }

        $templatesByType = [
            'admin' => $this->templateRepository->getActiveByType('admin'),
            'user' => $this->templateRepository->getActiveByType('user'),
        ];

        foreach ($filesystemLayouts as $layoutInfo) {
            $type = $layoutInfo['type'];
            $templates = $templatesByType[$type] ?? collect();

            if ($templates->isEmpty()) {
                $report->addLayoutResult(
                    $layoutInfo['canonical'],
                    true,
                    $layoutInfo['version'],
                    null,
                    "[{$label}] {$layoutInfo['canonical']} — 활성 {$type} template 없음 (검증 생략)",
                );

                continue;
            }

            $this->reconcileLayoutAcrossTemplates($moduleId, $layoutInfo, $templates, $label, $report);
        }

        return $report;
    }

    /**
     * module layout sync 직후 — refresh 결과와 무관하게 filesystem 으로 module row 를 맞춘다.
     */
    public function repairModuleLayoutsFromFilesystem(string $moduleId): void
    {
        $report = new PlatformLayoutReconcileReport();
        $filesystemLayouts = $this->discoverFilesystemLayouts($moduleId);

        if ($filesystemLayouts === []) {
            return;
        }

        $templatesByType = [
            'admin' => $this->templateRepository->getActiveByType('admin'),
            'user' => $this->templateRepository->getActiveByType('user'),
        ];

        foreach ($filesystemLayouts as $layoutInfo) {
            $templates = $templatesByType[$layoutInfo['type']] ?? collect();
            if ($templates->isEmpty()) {
                continue;
            }

            foreach ($templates as $template) {
                $this->purgeOrphanShortNameLayout($template, $layoutInfo, 'platform', $report);
                $this->purgeStaleTemplateOverrides($template, $layoutInfo, $report);
                $this->forceModuleLayoutFromFilesystem($template, $moduleId, $layoutInfo, 'platform', $report);
            }
        }
    }

    /**
     * @param  Collection<int, Template>  $templates
     */
    private function reconcileLayoutAcrossTemplates(
        string $moduleId,
        array $layoutInfo,
        Collection $templates,
        string $label,
        PlatformLayoutReconcileReport $report,
    ): void {
        $canonical = $layoutInfo['canonical'];
        $fileVersion = $layoutInfo['version'];
        $verified = false;
        $lastServedVersion = null;
        $layoutOk = true;

        foreach ($templates as $template) {
            $this->purgeOrphanShortNameLayout($template, $layoutInfo, $label, $report);
            $this->purgeStaleTemplateOverrides($template, $layoutInfo, $report);
            $this->forceModuleLayoutFromFilesystem($template, $moduleId, $layoutInfo, $label, $report);

            $layoutExists = TemplateLayout::query()
                ->where('template_id', $template->id)
                ->where('name', $canonical)
                ->exists();

            if (! $layoutExists) {
                $layoutOk = false;
                $report->addMessage("[{$label}] {$canonical} (template {$template->identifier}) module row 없음");

                continue;
            }

            $layout = $this->layoutResolver->resolve($canonical, $template->id);

            if ($layout === null) {
                $layoutOk = false;
                $report->addMessage("[{$label}] {$canonical} (template {$template->identifier}) resolve 실패");

                continue;
            }

            if (
                $layout->source_type === LayoutSourceType::Template
                && $layout->source_identifier !== null
            ) {
                $layoutOk = false;
                $report->addMessage("[{$label}] {$canonical} (template {$template->identifier}) — template override 가 module layout 을 가림");

                continue;
            }

            $dbContent = is_array($layout->content)
                ? $layout->content
                : json_decode((string) $layout->content, true);

            if (! is_array($dbContent)) {
                $layoutOk = false;
                $report->addMessage("[{$label}] {$canonical} (template {$template->identifier}) served content 파싱 실패");

                continue;
            }

            $dbVersion = (string) ($dbContent['version'] ?? '0');
            $lastServedVersion = $dbVersion;

            if (! $this->servedContentMatchesFilesystem($dbContent, $layoutInfo['data'], $fileVersion)) {
                $layoutOk = false;
                $report->addMessage("[{$label}] {$canonical} (template {$template->identifier}) served v{$dbVersion} ≠ filesystem v{$fileVersion}");

                continue;
            }

            $verified = true;
        }

        if ($verified && $layoutOk) {
            $source = 'module';
            $report->addLayoutResult(
                $canonical,
                true,
                $fileVersion,
                $lastServedVersion,
                "[{$label}] {$canonical} layout OK (served v{$lastServedVersion}, filesystem v{$fileVersion}, {$source})",
            );
        } elseif (! $verified) {
            $report->addLayoutResult(
                $canonical,
                false,
                $fileVersion,
                $lastServedVersion,
                "[{$label}] {$canonical} reconcile 실패",
            );
        } else {
            $report->addLayoutResult(
                $canonical,
                false,
                $fileVersion,
                $lastServedVersion,
                "[{$label}] {$canonical} reconcile 실패 (일부 template 검증 실패)",
            );
        }
    }

    /**
     * @param  array<string, mixed>  $fileData
     */
    private function purgeStaleTemplateOverrides(
        Template $template,
        array $layoutInfo,
        PlatformLayoutReconcileReport $report,
    ): void {
        $canonical = $layoutInfo['canonical'];
        $baseName = $layoutInfo['base_name'];
        $fileVersion = $layoutInfo['version'];
        $fileData = $layoutInfo['data'];

        $overrides = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->whereIn('name', [$canonical, $baseName])
            ->fromTemplates()
            ->get();

        foreach ($overrides as $override) {
            $content = is_array($override->content)
                ? $override->content
                : json_decode((string) $override->content, true);

            if (! is_array($content) || ! $this->overrideContentIsStale($content, $fileData, $fileVersion)) {
                continue;
            }

            $overrideVersion = (string) ($content['version'] ?? '0');
            $this->layoutService->clearDependentLayoutsCache($template->id, (string) $override->name);
            $override->forceDelete();

            $report->addMessage("[{$template->identifier}] stale template override 제거: {$override->name} v{$overrideVersion}");
        }
    }

    private function purgeOrphanShortNameLayout(
        Template $template,
        array $layoutInfo,
        string $label,
        PlatformLayoutReconcileReport $report,
    ): void {
        $canonical = $layoutInfo['canonical'];
        $baseName = $layoutInfo['base_name'];

        if ($baseName === $canonical) {
            return;
        }

        $orphan = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->where('name', $baseName)
            ->first();

        if ($orphan === null) {
            return;
        }

        $this->layoutService->clearDependentLayoutsCache($template->id, $baseName);
        $this->layoutService->clearDependentLayoutsCache($template->id, $canonical);
        $orphan->forceDelete();

        $report->addMessage("[{$label}] [{$template->identifier}] orphan short-name layout 삭제: {$baseName} (SSOT: {$canonical})");
    }

    /**
     * @param  array<string, mixed>  $layoutInfo
     */
    private function forceModuleLayoutFromFilesystem(
        Template $template,
        string $moduleId,
        array $layoutInfo,
        string $label,
        PlatformLayoutReconcileReport $report,
    ): void {
        $canonical = $layoutInfo['canonical'];
        $fileData = $layoutInfo['data'];
        $fileVersion = $layoutInfo['version'];

        $moduleLayout = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->where('name', $canonical)
            ->fromModules()
            ->first();

        if ($moduleLayout === null) {
            $this->moduleService->refreshModuleLayouts($moduleId);
            $moduleLayout = TemplateLayout::query()
                ->where('template_id', $template->id)
                ->where('name', $canonical)
                ->fromModules()
                ->first();
        }

        if ($moduleLayout === null) {
            $report->addMessage("[{$label}] [{$template->identifier}] {$canonical} module row 없음 (refresh 후에도)");

            return;
        }

        $content = is_array($moduleLayout->content)
            ? $moduleLayout->content
            : json_decode((string) $moduleLayout->content, true);

        if (! is_array($content)) {
            $report->addMessage("[{$label}] [{$template->identifier}] {$canonical} module content 파싱 실패");

            return;
        }

        $dbVersion = (string) ($content['version'] ?? '0');

        if ($this->servedContentMatchesFilesystem($content, $fileData, $fileVersion)) {
            return;
        }

        $moduleLayout->update([
            'content' => $fileData,
            'extends' => $fileData['extends'] ?? $moduleLayout->extends,
        ]);

        $this->layoutService->clearDependentLayoutsCache($template->id, $canonical);
        $this->layoutResolver->clearResolutionCache($canonical, $template->id);

        $report->addMessage("[{$label}] [{$template->identifier}] module layout filesystem 강제 반영: {$canonical} v{$dbVersion} → v{$fileVersion}");
    }

    /**
     * @param  array<string, mixed>  $content
     * @param  array<string, mixed>  $fileData
     */
    private function overrideContentIsStale(array $content, array $fileData, string $fileVersion): bool
    {
        $version = (string) ($content['version'] ?? '0');

        if (version_compare($version, $fileVersion, '<')) {
            return true;
        }

        return ! $this->servedContentMatchesFilesystem($content, $fileData, $fileVersion);
    }

    /**
     * @param  array<string, mixed>  $served
     * @param  array<string, mixed>  $fileData
     */
    public function servedContentMatchesFilesystem(array $served, array $fileData, string $fileVersion): bool
    {
        return $served === $fileData;
    }
}
