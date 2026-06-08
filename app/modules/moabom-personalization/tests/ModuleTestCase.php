<?php

namespace Modules\Moabom\Personalization\Tests;

use App\Enums\ExtensionStatus;
use App\Models\Module;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Personalization\Providers\PersonalizationServiceProvider;
use Tests\TestCase;

abstract class ModuleTestCase extends TestCase
{
    use DatabaseTransactions;

    protected static bool $migrated = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->registerModuleAutoload();
        $this->app->register(PersonalizationServiceProvider::class);
        $this->runModuleMigrationIfNeeded();
        $this->registerModuleAsActive();
        $this->registerModuleRoutes();
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

        // moabom-system 의 ApplyMoabomUserLocale 미들웨어가 인증 요청마다 user_settings 를
        // 조회하므로(격리 CI 에서 moabom-system 마이그레이션 미수행), 해당 테이블을 선마이그레이션한다.
        if (! Schema::hasTable('moabom_system_user_settings')) {
            $this->artisan('migrate', [
                '--path' => base_path('modules/moabom-system/database/migrations'),
                '--realpath' => true,
            ]);
        }

        static::$migrated = true;
    }

    protected function registerModuleAsActive(): void
    {
        Module::firstOrCreate(
            ['identifier' => 'moabom-personalization'],
            [
                'vendor' => 'moabom',
                'name' => ['ko' => '개인화', 'en' => 'Personalization'],
                'status' => ExtensionStatus::Active->value,
                'version' => '0.1.0',
                'config' => [],
            ]
        );
    }

    protected function registerModuleAutoload(): void
    {
        $moduleBasePath = $this->getModuleBasePath().'/src/';

        spl_autoload_register(function ($class) use ($moduleBasePath) {
            $prefix = 'Modules\\Moabom\\Personalization\\';
            $len = strlen($prefix);

            if (strncmp($prefix, $class, $len) !== 0) {
                return;
            }

            $relativeClass = substr($class, $len);
            $file = $moduleBasePath.str_replace('\\', '/', $relativeClass).'.php';

            if (file_exists($file)) {
                require $file;
            }
        });
    }

    protected function registerModuleRoutes(): void
    {
        Route::prefix('api/modules/moabom-personalization')
            ->name('api.modules.moabom-personalization.')
            ->middleware('api')
            ->group($this->getModuleBasePath().'/src/routes/api.php');
    }
}
