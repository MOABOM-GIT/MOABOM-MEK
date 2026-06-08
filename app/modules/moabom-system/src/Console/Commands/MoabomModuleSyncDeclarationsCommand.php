<?php

namespace Modules\Moabom\System\Console\Commands;

use App\Contracts\Extension\ModuleInterface;
use App\Contracts\Repositories\ModuleRepositoryInterface;
use App\Extension\ExtensionManager;
use App\Extension\ModuleManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Modules\Moabom\System\Saas\TenantAdminMenuPolicy;

/**
 * 활성 modules/{id} 의 module.php 선언(권한·메뉴 등)을 DB에 동기화.
 *
 * Cloud Run 이미지에는 _bundled 가 없어 module:update 가 실패한다.
 * G7 ModuleManager::syncDeclarativeArtifacts() 를 직접 호출한다.
 */
class MoabomModuleSyncDeclarationsCommand extends Command
{
    protected $signature = 'moabom:module-sync-declarations {identifier : moabom-system 등}';

    protected $description = '활성 모듈의 권한·메뉴 선언을 DB에 동기화 (Cloud Run 운영용)';

    public function handle(
        ModuleManager $moduleManager,
        ModuleRepositoryInterface $moduleRepository,
    ): int {
        $identifier = (string) $this->argument('identifier');

        if ($moduleManager->getModule($identifier) === null) {
            $moduleManager->loadModules();
        }

        $module = $this->resolveModule($moduleManager, $moduleRepository, $identifier);

        if ($module === null) {
            $this->error("모듈을 찾을 수 없습니다: {$identifier}");

            return self::FAILURE;
        }

        $this->info("선언 동기화: {$identifier} …");
        $moduleManager->syncDeclarativeArtifacts($module);
        if ($identifier === 'moabom-system') {
            $hygiene = app(TenantAdminMenuPolicy::class)->applyHygiene();
            if ($hygiene['purged'] > 0 || $hygiene['linked'] > 0) {
                $this->line(sprintf(
                    '  [tenant-menu-hygiene] purged=%d linked=%d',
                    $hygiene['purged'],
                    $hygiene['linked'],
                ));
            }
        }
        $this->syncModuleManifestMetadata($module, $moduleRepository);
        $this->info("✅ {$identifier} 권한·메뉴·역할·manifest 메타 동기화 완료");

        return self::SUCCESS;
    }

    private function resolveModule(
        ModuleManager $moduleManager,
        ModuleRepositoryInterface $moduleRepository,
        string $identifier,
    ): ?ModuleInterface {
        $loaded = $moduleManager->getModule($identifier);
        if ($loaded instanceof ModuleInterface) {
            return $loaded;
        }

        foreach ($moduleManager->getAllModules() as $module) {
            if ($module->getIdentifier() === $identifier) {
                return $module;
            }
        }

        $record = $moduleRepository->findByIdentifier($identifier);
        if ($record === null) {
            return null;
        }

        $moduleFile = base_path("modules/{$identifier}/module.php");
        if (! File::exists($moduleFile)) {
            return null;
        }

        $namespace = ExtensionManager::directoryToNamespace($identifier);
        $moduleClass = "Modules\\{$namespace}\\Module";

        if (! class_exists($moduleClass, false)) {
            require_once $moduleFile;
        }

        if (! class_exists($moduleClass)) {
            return null;
        }

        $instance = new $moduleClass;

        return $instance instanceof ModuleInterface ? $instance : null;
    }

    /**
     * module.json 의 name·version·description 을 DB modules row 에 반영.
     * 관리자 모듈 목록은 DB 컬럼을 우선하므로 manifest-only 변경 시에도 UI가 갱신되게 한다.
     */
    private function syncModuleManifestMetadata(
        ModuleInterface $module,
        ModuleRepositoryInterface $moduleRepository,
    ): void {
        $moduleRepository->updateByIdentifier($module->getIdentifier(), [
            'name' => $module->getName(),
            'version' => $module->getVersion(),
            'description' => $module->getDescription(),
            'updated_at' => now(),
        ]);
    }
}
