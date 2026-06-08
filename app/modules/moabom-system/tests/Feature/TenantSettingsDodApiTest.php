<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Feature;

use App\Enums\ExtensionOwnerType;
use App\Enums\PermissionType;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Http\Controllers\Admin\HomeBackgroundController;
use Modules\Moabom\System\Http\Controllers\Admin\SystemSettingsController;
use Modules\Moabom\System\Http\Controllers\PublicShellBootController;
use Modules\Moabom\System\Http\Middleware\ResolveMoabomTenant;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Tests\ModuleTestCase;

/**
 * §8 DoD — G7 general(사이트명) + moabom-system admin/settings(배경·appearance).
 */
class TenantSettingsDodApiTest extends ModuleTestCase
{
    private User $adminUser;

    private const MOABOM_ADMIN_SETTINGS = '/api/modules/moabom-system/admin/settings';

    private const G7_ADMIN_SETTINGS = '/api/admin/settings';

    private const HOME_BACKGROUNDS = '/api/modules/moabom-system/admin/home-backgrounds';

    private const SHELL_BOOT = '/api/modules/moabom-system/public/shell-boot';

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([ResolveMoabomTenant::class]);

        config(['moabom-system.saas.enabled' => false]);
        Storage::fake('settings');

        $this->app->register(SystemServiceProvider::class);
        $this->registerRoutes();
        $this->adminUser = $this->createAdminWithSettingsPermissions();
    }

    public function test_site_name_and_description_reflect_in_shell_boot(): void
    {
        $siteName = '상쾌한이비인후과';
        $siteDesc = 'DoD PHPUnit 설명';

        $this->actingAs($this->adminUser)
            ->postJson(self::G7_ADMIN_SETTINGS, [
                '_tab' => 'general',
                'general' => [
                    'site_name' => $siteName,
                    'site_description' => $siteDesc,
                    'site_url' => 'http://localhost:8080',
                    'admin_email' => 'admin@moabom.com',
                    'timezone' => 'Asia/Seoul',
                    'language' => 'ko',
                ],
            ])
            ->assertOk();

        $this->getJson(self::SHELL_BOOT.'?template=moabom-basic&scope=shell')
            ->assertOk()
            ->assertJsonPath('data.site.site_name', $siteName);
    }

    public function test_home_background_upload_delete_and_point_color_presets(): void
    {
        if (! extension_loaded('gd')) {
            $this->markTestSkipped('GD extension required for home background upload');
        }

        $upload = $this->actingAs($this->adminUser)
            ->post(self::HOME_BACKGROUNDS, [
                'file' => UploadedFile::fake()->image('dod-bg.jpg', 64, 64),
            ]);

        $upload->assertCreated();
        $bgId = (string) $upload->json('data.id');
        $this->assertNotEmpty($bgId);

        $this->actingAs($this->adminUser)
            ->putJson(self::MOABOM_ADMIN_SETTINGS, [
                'appearance' => [
                    'home_background_items' => [
                        ['id' => $bgId, 'mode' => 'light', 'point_color' => null],
                    ],
                    'point_color_presets' => ['#6366f1', '#a1b2c3'],
                ],
            ])
            ->assertOk();

        $presets = $this->actingAs($this->adminUser)
            ->getJson(self::MOABOM_ADMIN_SETTINGS)
            ->json('data.appearance.point_color_presets');

        $this->assertIsArray($presets);
        $this->assertContains('#a1b2c3', $presets);

        $this->getJson('/api/modules/moabom-system/home-backgrounds/'.$bgId.'/thumb')
            ->assertOk();

        $this->actingAs($this->adminUser)
            ->deleteJson(self::HOME_BACKGROUNDS.'/'.$bgId)
            ->assertOk();

        $this->getJson('/api/modules/moabom-system/home-backgrounds/'.$bgId.'/thumb')
            ->assertNotFound();
    }

    private function registerRoutes(): void
    {
        Route::prefix('api/modules/moabom-system')
            ->middleware(['api'])
            ->group(function (): void {
                Route::get('public/shell-boot', [PublicShellBootController::class, '__invoke']);
                Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function (): void {
                    Route::get('settings', [SystemSettingsController::class, 'index'])
                        ->middleware('permission:admin,moabom-system.settings.read');
                    Route::put('settings', [SystemSettingsController::class, 'store'])
                        ->middleware('permission:admin,moabom-system.settings.update');
                    Route::post('home-backgrounds', [HomeBackgroundController::class, 'store'])
                        ->middleware('permission:admin,moabom-system.settings.update');
                    Route::delete('home-backgrounds/{id}', [HomeBackgroundController::class, 'destroy'])
                        ->middleware('permission:admin,moabom-system.settings.update');
                });
                Route::get('home-backgrounds/{id}/{variant}', [
                    \Modules\Moabom\System\Http\Controllers\HomeBackgroundFileController::class,
                    'show',
                ])->whereUuid('id')->whereIn('variant', ['full', 'thumb']);
            });

        Route::post('/api/admin/settings', [\App\Http\Controllers\Api\Admin\SettingsController::class, 'store'])
            ->middleware(['api', 'auth:sanctum', 'admin']);
    }

    private function createAdminWithSettingsPermissions(): User
    {
        $role = Role::firstOrCreate(
            ['identifier' => 'admin'],
            [
                'name' => ['ko' => '관리자', 'en' => 'Administrator'],
                'description' => ['ko' => '시스템 관리자', 'en' => 'System administrator'],
                'extension_type' => ExtensionOwnerType::Core,
                'extension_identifier' => 'core',
                'is_active' => true,
            ],
        );

        foreach (['moabom-system.settings.read', 'moabom-system.settings.update'] as $identifier) {
            $permission = Permission::firstOrCreate(
                ['identifier' => $identifier],
                [
                    'name' => ['ko' => $identifier, 'en' => $identifier],
                    'description' => ['ko' => $identifier, 'en' => $identifier],
                    'extension_type' => ExtensionOwnerType::Module,
                    'extension_identifier' => 'moabom-system',
                    'type' => PermissionType::Admin->value,
                ],
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $adminAccess = Permission::firstOrCreate(
            ['identifier' => 'core.admin.access'],
            [
                'name' => ['ko' => '관리자 접근', 'en' => 'Admin Access'],
                'description' => ['ko' => '관리자 접근', 'en' => 'Admin Access'],
                'extension_type' => ExtensionOwnerType::Core,
                'extension_identifier' => 'core',
                'type' => PermissionType::Admin->value,
            ],
        );
        $role->permissions()->syncWithoutDetaching([$adminAccess->id]);

        $user = User::factory()->create();
        $user->roles()->attach($role->id);

        return $user->fresh(['roles.permissions']);
    }
}
