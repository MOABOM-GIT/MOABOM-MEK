<?php

namespace Modules\Moabom\System\Tests;

use App\Enums\ExtensionStatus;
use App\Models\Module;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

abstract class ModuleTestCase extends TestCase
{
    use DatabaseTransactions;

    protected static bool $migrated = false;

    protected function setUp(): void
    {
        $this->registerModuleAutoload();

        parent::setUp();
        $this->runModuleMigrationIfNeeded();
        $this->registerModuleAsActive();
    }

    protected function getModuleBasePath(): string
    {
        return dirname(__DIR__);
    }

    protected function runModuleMigrationIfNeeded(): void
    {
        if (static::$migrated) {
            return;
        }

        if (! Schema::hasTable('users') || ! Schema::hasTable('modules')) {
            $this->artisan('migrate');
        }

        // 2026-06-02 모듈 분리: `moabom_system_generated_apps` 는 moabom-apps 가,
        // `moabom_system_cpap_measurements` 는 moabom-cpap 이 소유.
        if (! Schema::hasTable('moabom_system_user_settings')) {
            $this->artisan('migrate', [
                '--path' => $this->getModuleBasePath().'/database/migrations',
                '--realpath' => true,
            ]);
        }

        static::$migrated = true;
    }

    protected function registerModuleAsActive(): void
    {
        Module::firstOrCreate(
            ['identifier' => 'moabom-system'],
            [
                'vendor' => 'moabom',
                'name' => ['ko' => 'Moabom 시스템', 'en' => 'Moabom System'],
                'status' => ExtensionStatus::Active->value,
                'version' => '0.6.5',
                'config' => [],
            ]
        );
    }

    protected function registerModuleAutoload(): void
    {
        $moduleBasePath = $this->getModuleBasePath().'/src/';

        foreach ([
            'Repositories/MoabomJsonConfigRepository.php',
            'Services/SystemSettingsService.php',
        ] as $relativePath) {
            $file = $moduleBasePath.$relativePath;
            if (is_file($file)) {
                require_once $file;
            }
        }

        // tests/bootstrap.php 가 활성 moabom-system PSR-4 를 prepend 하므로, SaaS 코드를 우선한다.
        static $prependedActivePsr4 = false;
        if (! $prependedActivePsr4) {
            foreach (\Composer\Autoload\ClassLoader::getRegisteredLoaders() as $loader) {
                $loader->addPsr4('Modules\\Moabom\\System\\', $moduleBasePath, true);
            }
            $prependedActivePsr4 = true;
        }

        spl_autoload_register(function ($class) use ($moduleBasePath): void {
            $prefix = 'Modules\\Moabom\\System\\';
            $len = strlen($prefix);

            if (strncmp($prefix, $class, $len) !== 0) {
                return;
            }

            $relativeClass = substr($class, $len);
            $file = $moduleBasePath.str_replace('\\', '/', $relativeClass).'.php';

            if (file_exists($file)) {
                require_once $file;
            }
        }, true, true);
    }
}
