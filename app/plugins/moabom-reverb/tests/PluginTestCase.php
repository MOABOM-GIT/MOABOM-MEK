<?php

declare(strict_types=1);

namespace Plugins\Moabom\Reverb\Tests;

use App\Enums\ExtensionStatus;
use App\Models\Plugin as PluginRecord;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Plugins\Moabom\Reverb\Providers\ReverbServiceProvider;
use Tests\TestCase;

abstract class PluginTestCase extends TestCase
{
    use DatabaseTransactions;

    protected static bool $migrated = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->registerPluginAutoload();
        $this->app->register(ReverbServiceProvider::class);
        $this->runCoreMigrationsIfNeeded();
        $this->registerPluginAsActive();
    }

    protected function getPluginBasePath(): string
    {
        return dirname(__DIR__);
    }

    protected function runCoreMigrationsIfNeeded(): void
    {
        if (static::$migrated) {
            return;
        }

        if (! Schema::hasTable('users') || ! Schema::hasTable('plugins')) {
            $this->artisan('migrate');
        }

        static::$migrated = true;
    }

    protected function registerPluginAsActive(): void
    {
        PluginRecord::firstOrCreate(
            ['identifier' => 'moabom-reverb'],
            [
                'vendor' => 'moabom',
                'name' => ['ko' => 'Moabom Reverb', 'en' => 'Moabom Reverb'],
                'status' => ExtensionStatus::Active->value,
                'version' => '0.1.0',
            ]
        );
    }

    protected function registerPluginAutoload(): void
    {
        $pluginBasePath = $this->getPluginBasePath().'/src/';

        spl_autoload_register(function ($class) use ($pluginBasePath): void {
            $prefix = 'Plugins\\Moabom\\Reverb\\';
            $len = strlen($prefix);

            if (strncmp($prefix, $class, $len) !== 0) {
                return;
            }

            $relativeClass = substr($class, $len);
            $file = $pluginBasePath.str_replace('\\', '/', $relativeClass).'.php';

            if (file_exists($file)) {
                require_once $file;
            }
        });
    }
}
