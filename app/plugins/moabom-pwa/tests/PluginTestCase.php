<?php

namespace Plugins\Moabom\Pwa\Tests;

use App\Enums\ExtensionStatus;
use App\Models\Plugin as PluginRecord;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Plugins\Moabom\Pwa\Providers\PwaServiceProvider;
use Tests\TestCase;

/**
 * moabom-pwa 플러그인 공통 테스트 베이스.
 *
 * - PSR-4 오토로드 등록(번들/활성 디렉토리 무관하게 클래스 해석).
 * - `PwaServiceProvider` 부팅 → 다국어 자동 로드.
 * - 코어 마이그레이션이 필요할 때만 `migrate` 실행.
 * - `plugins` 레코드를 활성 상태로 시드해, 라우트 등록 가드를 통과시킨다.
 */
abstract class PluginTestCase extends TestCase
{
    use DatabaseTransactions;

    protected static bool $migrated = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->registerPluginAutoload();
        $this->app->register(PwaServiceProvider::class);
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
            ['identifier' => 'moabom-pwa'],
            [
                'vendor' => 'moabom',
                'name' => ['ko' => 'Moabom PWA', 'en' => 'Moabom PWA'],
                'status' => ExtensionStatus::Active->value,
                'version' => '0.1.1',
            ]
        );
    }

    protected function registerPluginAutoload(): void
    {
        $pluginBasePath = $this->getPluginBasePath().'/src/';

        spl_autoload_register(function ($class) use ($pluginBasePath) {
            $prefix = 'Plugins\\Moabom\\Pwa\\';
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
