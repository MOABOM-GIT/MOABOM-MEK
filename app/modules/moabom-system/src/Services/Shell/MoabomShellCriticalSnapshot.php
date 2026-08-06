<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services\Shell;

use App\Extension\Traits\ClearsTemplateCaches;
use App\Services\LayoutService;
use App\Services\TemplateService;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\System\Services\MoabomShellRoutesFilter;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

/**
 * 홈 셸 critical 스냅샷 — config.json · home layout · (선택) shell routes.
 *
 * Blade 인라인·shell-boot `critical` 은 config+home 만 필요하므로
 * `buildConfigHomeOnly()` 로 routes 머지를 생략한다(캐시 미스 TTFB).
 * components.json 은 nginx 정적 서빙(디스크)이 SSOT. lang JSON 본문은 인라인하지 않는다.
 */
final class MoabomShellCriticalSnapshot
{
    public function __construct(
        private readonly TemplateService $templateService,
        private readonly LayoutService $layoutService,
        private readonly MoabomShellRoutesFilter $shellRoutesFilter,
    ) {}

    /**
     * Blade / shell-boot critical 용 — config+home+cache_version 만 (routes 생략).
     *
     * @return array{
     *   template: string,
     *   cache_version: int,
     *   config: array<string, mixed>|null,
     *   home: array<string, mixed>|null
     * }
     */
    public function buildConfigHomeOnly(string $templateIdentifier = 'moabom-basic'): array
    {
        $cacheVersion = ClearsTemplateCaches::getExtensionCacheVersion();

        /** @var array{
         *   template: string,
         *   cache_version: int,
         *   config: array<string, mixed>|null,
         *   home: array<string, mixed>|null
         * } $snapshot
         */
        $snapshot = MoabomPublicApiCache::rememberShared(
            MoabomPublicApiCacheKeys::shellCritical($templateIdentifier, $cacheVersion),
            MoabomPublicApiCacheKeys::shellCriticalSharedObject($templateIdentifier),
            fn (): array => [
                'template' => $templateIdentifier,
                'cache_version' => $cacheVersion,
                'config' => $this->resolveConfig($templateIdentifier, $cacheVersion),
                'home' => $this->resolveHomeLayout($templateIdentifier),
            ],
        );

        return $snapshot;
    }

    /**
     * @return array{
     *   template: string,
     *   cache_version: int,
     *   config: array<string, mixed>|null,
     *   home: array<string, mixed>|null,
     *   shell_routes: array{version?: string, routes?: array<int, array<string, mixed>>}|null
     * }
     */
    public function build(string $templateIdentifier = 'moabom-basic'): array
    {
        $base = $this->buildConfigHomeOnly($templateIdentifier);

        return [
            ...$base,
            'shell_routes' => $this->resolveShellRoutes($templateIdentifier),
        ];
    }

    /**
     * Blade 인라인용 — HTML 비대화 방지로 config+home+cache_version 만.
     *
     * @return array{
     *   template: string,
     *   cache_version: int,
     *   config: array<string, mixed>|null,
     *   home: array<string, mixed>|null
     * }
     */
    public function buildInline(string $templateIdentifier = 'moabom-basic'): array
    {
        return $this->buildConfigHomeOnly($templateIdentifier);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveConfig(string $identifier, int $cacheVersion): ?array
    {
        $path = base_path("templates/{$identifier}/template.json");
        if (! is_file($path)) {
            return null;
        }

        try {
            /** @var array<string, mixed>|null $data */
            $data = json_decode((string) file_get_contents($path), true);
            if (! is_array($data)) {
                return null;
            }
            $data['cache_version'] = $cacheVersion;

            return $data;
        } catch (\Throwable $e) {
            Log::warning('MoabomShellCriticalSnapshot: config read failed', [
                'template' => $identifier,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveHomeLayout(string $identifier): ?array
    {
        try {
            /** @var array<string, mixed> $layout */
            $layout = $this->layoutService->getLayout($identifier, 'home', false);

            return $layout;
        } catch (\Throwable $e) {
            Log::warning('MoabomShellCriticalSnapshot: home layout failed', [
                'template' => $identifier,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @return array{version?: string, routes?: array<int, array<string, mixed>>}|null
     */
    private function resolveShellRoutes(string $identifier): ?array
    {
        try {
            $result = $this->templateService->getRoutesDataWithModules($identifier);
            if (! ($result['success'] ?? false) || ! is_array($result['data'] ?? null)) {
                return null;
            }

            /** @var array{version?: string, routes?: array<int, array<string, mixed>>} $data */
            $data = $result['data'];
            $data['routes'] = $this->shellRoutesFilter->filterForShell($data['routes'] ?? [], $identifier);

            return $data;
        } catch (\Throwable $e) {
            Log::warning('MoabomShellCriticalSnapshot: shell routes failed', [
                'template' => $identifier,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
