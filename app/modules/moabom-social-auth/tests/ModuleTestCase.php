<?php

namespace Modules\Moabom\Social\Auth\Tests;

use App\Enums\ExtensionStatus;
use App\Models\Module;
use App\Models\Role;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Social\Auth\Providers\SocialAuthServiceProvider;
use Modules\Moabom\Social\Auth\Services\SocialAuthSettingsService;
use Tests\TestCase;

abstract class ModuleTestCase extends TestCase
{
    use DatabaseTransactions;

    protected static bool $migrated = false;

    protected function setUp(): void
    {
        parent::setUp();

        putenv('MOABOM_SOCIAL_AUTH_BROKER_ENABLED=false');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_HOST');
        unset($_ENV['MOABOM_SOCIAL_AUTH_BROKER_ENABLED'], $_ENV['MOABOM_SOCIAL_AUTH_BROKER_HOST']);

        $this->registerModuleAutoload();
        $this->app->register(SocialAuthServiceProvider::class);
        $this->runModuleMigrationIfNeeded();
        $this->registerModuleAsActive();
        $this->registerModuleRoutes();
        $this->createDefaultRoles();
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

        if (! Schema::hasTable('users') || ! Schema::hasTable('roles') || ! Schema::hasTable('modules')) {
            $this->artisan('migrate');
        }

        if (
            ! Schema::hasTable('social_accounts')
            || ! Schema::hasTable('social_auth_codes')
            || ! Schema::hasColumn('social_auth_codes', 'requires_profile_completion')
        ) {
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
            ['identifier' => 'moabom-social-auth'],
            [
                'vendor' => 'moabom',
                'name' => ['ko' => 'SNS 로그인', 'en' => 'Social Auth'],
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
            $prefix = 'Modules\\Moabom\\Social\\Auth\\';
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
        Route::prefix('api/modules/moabom-social-auth')
            ->name('api.modules.moabom-social-auth.')
            ->middleware('api')
            ->group($this->getModuleBasePath().'/src/routes/api.php');

        Route::prefix('modules/moabom-social-auth')
            ->name('web.modules.moabom-social-auth.')
            ->middleware('web')
            ->group($this->getModuleBasePath().'/src/routes/web.php');
    }

    protected function createDefaultRoles(): void
    {
        Role::firstOrCreate(
            ['identifier' => 'user'],
            ['name' => ['ko' => '일반 사용자', 'en' => 'User']]
        );
    }

    protected function setProviderEnv(string $provider): void
    {
        $prefix = 'SOCIAL_AUTH_'.strtoupper($provider);
        putenv("{$prefix}_CLIENT_ID=test-client-id");
        putenv("{$prefix}_CLIENT_SECRET=test-client-secret");
        putenv("{$prefix}_REDIRECT_URI=http://localhost/api/modules/moabom-social-auth/{$provider}/callback");
        $_ENV["{$prefix}_CLIENT_ID"] = 'test-client-id';
        $_ENV["{$prefix}_CLIENT_SECRET"] = 'test-client-secret';
        $_ENV["{$prefix}_REDIRECT_URI"] = "http://localhost/api/modules/moabom-social-auth/{$provider}/callback";

        app(SocialAuthSettingsService::class)->saveSettings([
            'providers' => [
                "{$provider}_enabled" => true,
                "{$provider}_client_id" => 'test-client-id',
                "{$provider}_client_secret" => 'test-client-secret',
                "{$provider}_redirect_uri" => "http://localhost/api/modules/moabom-social-auth/{$provider}/callback",
                'kakao_use_client_secret' => true,
            ],
        ]);
    }
}
