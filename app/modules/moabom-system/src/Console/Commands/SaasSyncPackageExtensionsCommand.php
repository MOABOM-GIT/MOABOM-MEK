<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Contracts\Repositories\ModuleRepositoryInterface;
use App\Contracts\Repositories\PluginRepositoryInterface;
use App\Enums\ExtensionStatus;
use App\Extension\ModuleManager;
use App\Extension\PluginManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\System\Saas\TenantPackageCatalog;

/**
 * hospital-default.json modules[]·plugins[] 를 DB install+active 와 맞춘다.
 *
 * Cloud Run 이미지에는 활성 디렉터리만 있고 _bundled 는 없다.
 * 코드 배포만으로 filesystem 에 모듈이 생겨도 modules/plugins 테이블 row 가 없으면
 * ModuleRouteServiceProvider 가 라우트를 등록하지 않는다(404·관리자 미설치).
 */
final class SaasSyncPackageExtensionsCommand extends Command
{
    protected $signature = 'moabom:saas:sync-package-extensions
        {--package=hospital-default : SaaS 패키지 ID (database/saas/packages/{id}.json)}
        {--declarations : post_bootstrap_artisan.module_sync_declarations 도 실행}
        {--skip-activate : install 만 하고 activate 는 생략}';

    protected $description = '패키지 카탈로그(modules[]·plugins[]) 기준으로 확장 install·activate 동기화 (Cloud Run idempotent)';

    public function handle(
        TenantPackageCatalog $catalog,
        ModuleManager $moduleManager,
        PluginManager $pluginManager,
        ModuleRepositoryInterface $moduleRepository,
        PluginRepositoryInterface $pluginRepository,
    ): int {
        $packageId = (string) $this->option('package');

        try {
            $package = $catalog->get($packageId);
        } catch (\Throwable $e) {
            $this->error("패키지를 읽을 수 없습니다: {$packageId} — {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->info("패키지 확장 동기화: {$package->id} (modules=".count($package->modules).', plugins='.count($package->plugins).')');

        $moduleManager->loadModules();
        $pluginManager->loadPlugins();

        $failures = 0;

        foreach ($package->modules as $identifier) {
            if ($this->ensureModule($identifier, $moduleManager, $moduleRepository) !== self::SUCCESS) {
                $failures++;
            }
        }

        foreach ($package->plugins as $identifier) {
            if ($this->ensurePlugin($identifier, $pluginManager, $pluginRepository) !== self::SUCCESS) {
                $failures++;
            }
        }

        if ((bool) $this->option('declarations')) {
            foreach ($package->moduleSyncDeclarations as $identifier) {
                if (! File::exists(base_path("modules/{$identifier}/module.php"))) {
                    continue;
                }
                $this->line("  declarations: {$identifier}");
                Artisan::call('moabom:module-sync-declarations', ['identifier' => $identifier]);
            }
        }

        ModuleManager::invalidateModuleStatusCache();
        PluginManager::invalidatePluginStatusCache();

        if ($failures > 0) {
            $this->warn("⚠️  {$failures}개 확장 동기화 실패 — 로그 확인");

            return self::FAILURE;
        }

        $this->info('✅ 패키지 확장 동기화 완료');

        return self::SUCCESS;
    }

    private function ensureModule(
        string $identifier,
        ModuleManager $moduleManager,
        ModuleRepositoryInterface $moduleRepository,
    ): int {
        if (! File::exists(base_path("modules/{$identifier}/module.php"))) {
            $this->line("  skip module {$identifier} (활성 디렉터리 없음 — 이미지 미포함)");

            return self::SUCCESS;
        }

        try {
            $record = $moduleRepository->findByIdentifier($identifier);

            if ($record === null) {
                $this->line("  install module {$identifier}");
                if (! $moduleManager->installModule($identifier)) {
                    $this->error("  install failed: {$identifier}");
                    Log::warning('moabom:saas:sync-package-extensions module install failed', ['identifier' => $identifier]);

                    return self::FAILURE;
                }
                $record = $moduleRepository->findByIdentifier($identifier);
            }

            if ((bool) $this->option('skip-activate')) {
                return self::SUCCESS;
            }

            if ($record !== null && $record->status !== ExtensionStatus::Active->value) {
                $this->line("  activate module {$identifier}");
                $exit = Artisan::call('module:activate', [
                    'identifier' => $identifier,
                    '--force' => true,
                ]);
                if ($exit !== self::SUCCESS) {
                    $this->error("  activate failed: {$identifier}");

                    return self::FAILURE;
                }
            }

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error("  module {$identifier}: {$e->getMessage()}");
            Log::warning('moabom:saas:sync-package-extensions module error', [
                'identifier' => $identifier,
                'error' => $e->getMessage(),
            ]);

            return self::FAILURE;
        }
    }

    private function ensurePlugin(
        string $identifier,
        PluginManager $pluginManager,
        PluginRepositoryInterface $pluginRepository,
    ): int {
        if (! File::exists(base_path("plugins/{$identifier}/plugin.php"))) {
            $this->line("  skip plugin {$identifier} (활성 디렉터리 없음 — 이미지 미포함)");

            return self::SUCCESS;
        }

        try {
            $record = $pluginRepository->findByIdentifier($identifier);

            if ($record === null) {
                $this->line("  install plugin {$identifier}");
                if (! $pluginManager->installPlugin($identifier)) {
                    $this->error("  install failed: {$identifier}");
                    Log::warning('moabom:saas:sync-package-extensions plugin install failed', ['identifier' => $identifier]);

                    return self::FAILURE;
                }
                $record = $pluginRepository->findByIdentifier($identifier);
            }

            if ((bool) $this->option('skip-activate')) {
                return self::SUCCESS;
            }

            if ($record !== null && $record->status !== ExtensionStatus::Active->value) {
                $this->line("  activate plugin {$identifier}");
                $exit = Artisan::call('plugin:activate', [
                    'identifier' => $identifier,
                    '--force' => true,
                ]);
                if ($exit !== self::SUCCESS) {
                    $this->error("  activate failed: {$identifier}");

                    return self::FAILURE;
                }
            }

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error("  plugin {$identifier}: {$e->getMessage()}");
            Log::warning('moabom:saas:sync-package-extensions plugin error', [
                'identifier' => $identifier,
                'error' => $e->getMessage(),
            ]);

            return self::FAILURE;
        }
    }
}
