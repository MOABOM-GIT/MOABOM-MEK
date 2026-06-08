<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Apps;

use App\Extension\ModuleManager;
use Illuminate\Support\Facades\Log;

/**
 * 활성 모듈의 app.json 을 스캔해 앱 매니페스트를 집계한다 (Phase 4 — 앱 SDK 토대).
 *
 * - 테넌트 필터: ModuleManager::getActiveModules() 가 (테넌트별) 활성 모듈만 주므로
 *   비활성 모듈의 앱은 자동 제외된다.
 * - moabom-apps 가 "앱 플랫폼" 역할로 자신/타 모듈(moabom-cpap 등)의 app.json 을 모두 모은다.
 * - app.json 은 단일 매니페스트({...}) 또는 다중({"apps":[...]}) 형식을 지원.
 */
final class AppRegistry implements AppRegistryInterface
{
    public function __construct(
        private readonly ModuleManager $moduleManager,
    ) {}

    public function all(): array
    {
        $activeIds = [];
        foreach ($this->moduleManager->getActiveModules() as $module) {
            $activeIds[$module->getIdentifier()] = true;
        }

        $manifests = [];
        foreach ($this->manifestFiles() as $file) {
            $moduleId = basename(dirname($file));
            if (! isset($activeIds[$moduleId])) {
                continue;
            }

            $decoded = json_decode((string) file_get_contents($file), true);
            if (! is_array($decoded)) {
                Log::warning("app.json 파싱 실패: {$file}");

                continue;
            }

            foreach ($this->normalizeEntries($decoded) as $entry) {
                if (! is_array($entry)) {
                    continue;
                }
                try {
                    $manifests[] = AppManifest::fromArray($moduleId, $entry);
                } catch (\Throwable $e) {
                    Log::warning("app.json 매니페스트 무시 ({$moduleId}): ".$e->getMessage());
                }
            }
        }

        usort(
            $manifests,
            static fn (AppManifest $a, AppManifest $b): int => [$a->order, $a->id] <=> [$b->order, $b->id],
        );

        return $manifests;
    }

    public function forShell(string $template): array
    {
        $out = [];
        foreach ($this->all() as $manifest) {
            if ($manifest->frontendTemplate !== null && $manifest->frontendTemplate !== $template) {
                continue;
            }
            $out[] = $manifest->toArray();
        }

        return $out;
    }

    /**
     * @return list<string>
     */
    private function manifestFiles(): array
    {
        $pattern = base_path('modules/*/app.json');

        return glob($pattern) ?: [];
    }

    /**
     * @param  array<string, mixed>  $decoded
     * @return list<mixed>
     */
    private function normalizeEntries(array $decoded): array
    {
        if (isset($decoded['apps']) && is_array($decoded['apps'])) {
            return array_values($decoded['apps']);
        }

        return [$decoded];
    }
}
