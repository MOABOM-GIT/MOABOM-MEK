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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * platform DB module layouts — filesystem SSOT 정합 (전 모듈·전 layout).
 *
 * template override·단축명 orphan 제거, module row 강제 반영, resolver 검증.
 * 배포 Job(moabom:saas:reconcile-platform-module-layouts) 및 sync-module-layouts 가 공유한다.
 *
 * DB 저장·비교 단위는 partial 해석 완료본(ModuleManager::validateLayoutFiles 와 동일).
 *
 * SoftDeletes 계약 (RF-24):
 * - TemplateLayout::refresh() / findOrFail / forceDelete / delete 금지 (배포 Job 경로)
 * - content 읽기·쓰기는 DB::table('template_layouts') 만 사용
 * - 중복 row 는 최신 id 만 overwrite (삭제하지 않음)
 * - stale override·orphan short-name 은 경고만 (삭제 생략)
 */
final class PlatformModuleLayoutReconciler
{
    public function __construct(
        private readonly LayoutService $layoutService,
        private readonly LayoutResolverService $layoutResolver,
        private readonly ModuleService $moduleService,
        private readonly TemplateRepository $templateRepository,
        private readonly LayoutPersistenceNormalizer $layoutPersistenceNormalizer,
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

                $rawData = json_decode((string) file_get_contents($path), true);
                if (! is_array($rawData)) {
                    continue;
                }

                try {
                    $data = $this->layoutPersistenceNormalizer->normalize($rawData, $path);
                } catch (\Throwable $e) {
                    Log::warning('module layout partial 정규화 실패 — reconcile 대상에서 제외', [
                        'module' => $moduleId,
                        'path' => $path,
                        'error' => $e->getMessage(),
                    ]);

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

        try {
            $filesystemLayouts = $this->discoverFilesystemLayouts($moduleId);
        } catch (\Throwable $e) {
            Log::warning('repairModuleLayoutsFromFilesystem discover 실패', [
                'module' => $moduleId,
                'error' => $e->getMessage(),
            ]);

            return;
        }

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
                try {
                    $this->purgeOrphanShortNameLayout($template, $layoutInfo, 'platform', $report);
                    $this->purgeStaleTemplateOverrides($template, $layoutInfo, $report);
                    $this->forceModuleLayoutFromFilesystem($template, $moduleId, $layoutInfo, 'platform', $report);
                } catch (\Throwable $e) {
                    Log::warning('repairModuleLayoutsFromFilesystem layout 처리 실패', [
                        'module' => $moduleId,
                        'layout' => $layoutInfo['canonical'] ?? '',
                        'template' => $template->identifier,
                        'error' => $e->getMessage(),
                    ]);
                }
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
            try {
                $this->purgeOrphanShortNameLayout($template, $layoutInfo, $label, $report);
                $this->purgeStaleTemplateOverrides($template, $layoutInfo, $report);
                $this->forceModuleLayoutFromFilesystem($template, $moduleId, $layoutInfo, $label, $report);
            } catch (\Throwable $e) {
                $layoutOk = false;
                $report->addMessage(
                    "[{$label}] {$canonical} (template {$template->identifier}) 처리 예외: ".$e->getMessage(),
                );

                continue;
            }

            $moduleLayout = TemplateLayout::query()
                ->where('template_id', $template->id)
                ->where('name', $canonical)
                ->fromModules()
                ->orderByDesc('id')
                ->first();

            if ($moduleLayout === null) {
                $layoutOk = false;
                $report->addMessage("[{$label}] {$canonical} (template {$template->identifier}) module row 없음");

                continue;
            }

            // override 가림 여부 — resolver 예외 시 DB module row 검증만 진행
            try {
                $resolved = $this->layoutResolver->resolve($canonical, $template->id);
                if (
                    $resolved !== null
                    && $resolved->source_type === LayoutSourceType::Template
                    && $resolved->source_identifier !== null
                ) {
                    $layoutOk = false;
                    $report->addMessage("[{$label}] {$canonical} (template {$template->identifier}) — template override 가 module layout 을 가림");

                    continue;
                }
            } catch (\Throwable $e) {
                $report->addMessage(
                    "[{$label}] {$canonical} (template {$template->identifier}) resolver 예외(무시): ".$e->getMessage(),
                );
            }

            // SoftDeletes: Eloquent refresh()/cast 가 ModelNotFound 를 던질 수 있어 DB 직접 조회
            $raw = DB::table('template_layouts')->where('id', (int) $moduleLayout->id)->value('content');
            $dbContent = is_string($raw)
                ? json_decode($raw, true)
                : (is_array($moduleLayout->content) ? $moduleLayout->content : null);

            if (! is_array($dbContent)) {
                $layoutOk = false;
                $report->addMessage("[{$label}] {$canonical} (template {$template->identifier}) served content 파싱 실패");

                continue;
            }

            $dbVersion = (string) ($dbContent['version'] ?? '0');
            $lastServedVersion = $dbVersion;

            if (! $this->servedContentMatchesFilesystem($dbContent, $layoutInfo['data'], $fileVersion)) {
                $this->forceModuleLayoutFromFilesystem($template, $moduleId, $layoutInfo, $label, $report);
                $raw = DB::table('template_layouts')
                    ->where('template_id', $template->id)
                    ->where('name', $canonical)
                    ->where('source_type', LayoutSourceType::Module->value)
                    ->orderByDesc('id')
                    ->value('content');
                $dbContent = is_string($raw) ? json_decode($raw, true) : null;
                $dbVersion = is_array($dbContent) ? (string) ($dbContent['version'] ?? '0') : '0';
                $lastServedVersion = $dbVersion;

                if (! is_array($dbContent) || ! $this->servedContentMatchesFilesystem($dbContent, $layoutInfo['data'], $fileVersion)) {
                    $layoutOk = false;
                    $report->addMessage("[{$label}] {$canonical} (template {$template->identifier}) served v{$dbVersion} ≠ filesystem v{$fileVersion}");

                    continue;
                }
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
        // SoftDeletes/observer findOrFail 충돌로 배포 Job 이 깨지지 않도록
        // stale override 는 삭제하지 않고 경고만 남긴다. module row 강제 반영이 SSOT.
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
            $report->addMessage(
                "[{$template->identifier}] stale template override 감지(삭제 생략): {$override->name} v{$overrideVersion}",
            );
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

        // SoftDeletes/observer findOrFail 충돌 방지 — 삭제는 생략, 검증은 canonical module row 만 사용
        $report->addMessage(
            "[{$label}] [{$template->identifier}] orphan short-name layout 감지(삭제 생략): {$baseName} (SSOT: {$canonical})",
        );
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

        try {
            $primary = TemplateLayout::query()
                ->where('template_id', $template->id)
                ->where('name', $canonical)
                ->fromModules()
                ->orderByDesc('id')
                ->first();

            if ($primary === null) {
                $this->moduleService->refreshModuleLayouts($moduleId);
                $primary = TemplateLayout::query()
                    ->where('template_id', $template->id)
                    ->where('name', $canonical)
                    ->fromModules()
                    ->orderByDesc('id')
                    ->first();
            }

            if ($primary === null) {
                $report->addMessage("[{$label}] [{$template->identifier}] {$canonical} module row 없음 (refresh 후에도)");

                return;
            }

            $primaryId = (int) $primary->id;

            $duplicateCount = TemplateLayout::query()
                ->where('template_id', $template->id)
                ->where('name', $canonical)
                ->fromModules()
                ->count();
            if ($duplicateCount > 1) {
                $report->addMessage(
                    "[{$label}] [{$template->identifier}] duplicate module layout {$duplicateCount}건 — 최신 #{$primaryId} 만 갱신",
                );
            }

            $rawContent = DB::table('template_layouts')->where('id', $primaryId)->value('content');
            $content = is_string($rawContent) ? json_decode($rawContent, true) : null;

            if (! is_array($content)) {
                $report->addMessage("[{$label}] [{$template->identifier}] {$canonical} module content 파싱 실패");

                return;
            }

            $dbVersion = (string) ($content['version'] ?? '0');
            $needsWrite = version_compare($dbVersion, $fileVersion, '!=')
                || ! $this->servedContentMatchesFilesystem($content, $fileData, $fileVersion);

            if (! $needsWrite) {
                return;
            }

            $existingExtends = DB::table('template_layouts')->where('id', $primaryId)->value('extends');

            DB::table('template_layouts')
                ->where('id', $primaryId)
                ->update([
                    'content' => json_encode($fileData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'extends' => $fileData['extends'] ?? $existingExtends,
                    'source_type' => LayoutSourceType::Module->value,
                    'source_identifier' => $moduleId,
                    'updated_at' => now(),
                ]);

            $this->safeClearLayoutCaches($template->id, [$canonical]);
            try {
                $this->layoutResolver->clearResolutionCacheByModule($moduleId);
            } catch (\Throwable) {
            }

            $verifyRaw = DB::table('template_layouts')->where('id', $primaryId)->value('content');
            $verifyContent = is_string($verifyRaw) ? json_decode($verifyRaw, true) : null;
            $verifyVersion = is_array($verifyContent) ? (string) ($verifyContent['version'] ?? '0') : '0';

            if (! is_array($verifyContent) || version_compare($verifyVersion, $fileVersion, '!=')) {
                $report->addMessage(
                    "[{$label}] [{$template->identifier}] {$canonical} 강제 반영 후 검증 실패 (db=v{$verifyVersion}, file=v{$fileVersion})",
                );

                return;
            }

            $report->addMessage(
                "[{$label}] [{$template->identifier}] module layout filesystem 강제 반영: {$canonical} v{$dbVersion} → v{$fileVersion}",
            );
        } catch (\Throwable $e) {
            $report->addMessage(
                "[{$label}] [{$template->identifier}] {$canonical} 강제 반영 예외: ".$e->getMessage(),
            );
        }
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
     * DB served content 와 filesystem 정규화본이 일치하는지 검증합니다.
     *
     * @param  array<string, mixed>  $served  DB content (partial 해석 완료본)
     * @param  array<string, mixed>  $fileData  discoverFilesystemLayouts() 의 data (partial 해석 완료본)
     */
    public function servedContentMatchesFilesystem(array $served, array $fileData, string $fileVersion): bool
    {
        return $served === $fileData;
    }

    /**
     * @param  list<string>  $layoutNames
     */
    private function safeClearLayoutCaches(int $templateId, array $layoutNames): void
    {
        foreach ($layoutNames as $layoutName) {
            try {
                $this->layoutService->clearDependentLayoutsCache($templateId, $layoutName);
            } catch (\Throwable) {
                // cache clear 실패해도 reconcile 은 계속
            }

            try {
                $this->layoutResolver->clearResolutionCache($layoutName, $templateId);
            } catch (\Throwable) {
            }
        }
    }
}
