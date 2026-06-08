<?php

namespace Modules\Moabom\Consulting\Tests;

use App\Enums\ExtensionStatus;
use App\Models\Module;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Consulting\Providers\ConsultingServiceProvider;
use Tests\TestCase;

abstract class ModuleTestCase extends TestCase
{
    use DatabaseTransactions;

    protected static bool $migrated = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->registerModuleAutoload();
        $this->app->register(ConsultingServiceProvider::class);
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

        if (! Schema::hasTable('moabom_consulting_contracts')) {
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
            ['identifier' => 'moabom-consulting'],
            [
                'vendor' => 'moabom',
                'name' => ['ko' => '스마트케어360 컨설팅', 'en' => 'SmartCare360 Consulting'],
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
            $prefix = 'Modules\\Moabom\\Consulting\\';
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
        Route::prefix('api/modules/moabom-consulting')
            ->name('api.modules.moabom-consulting.')
            ->middleware('api')
            ->group($this->getModuleBasePath().'/src/routes/api.php');
    }
}
