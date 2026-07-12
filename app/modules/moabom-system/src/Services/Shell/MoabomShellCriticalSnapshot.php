<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services\Shell;

use App\Extension\Traits\ClearsTemplateCaches;
use App\Services\LayoutService;
use App\Services\TemplateService;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\System\Services\MoabomShellRoutesFilter;

/**
 * 홈 셸 critical 스냅샷 — config.json · home layout · shell routes 를 1회 조립.
 *
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
        $cacheVersion = ClearsTemplateCaches::getExtensionCacheVersion();

        return [
            'template' => $templateIdentifier,
            'cache_version' => $cacheVersion,
            'config' => $this->resolveConfig($templateIdentifier, $cacheVersion),
            'home' => $this->resolveHomeLayout($templateIdentifier),
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
        $full = $this->build($templateIdentifier);

        return [
            'template' => $full['template'],
            'cache_version' => $full['cache_version'],
            'config' => $full['config'],
            'home' => $full['home'],
        ];
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
