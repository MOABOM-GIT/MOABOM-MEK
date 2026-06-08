<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Feature;

use App\Enums\ExtensionOwnerType;
use App\Enums\PermissionType;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Http\Controllers\Admin\SystemSettingsController;
use Modules\Moabom\System\Http\Middleware\ResolveMoabomTenant;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

/**
 * SaaS 운영 회귀: admin/settings PUT 시 appearance가 TenantSettingsWriter 경로로 저장되는지.
 */
class AdminSettingsSaasAppearanceStoreTest extends ModuleTestCase
{
    private const MOABOM_ADMIN_SETTINGS = '/api/modules/moabom-system/admin/settings';

    private User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([ResolveMoabomTenant::class]);

        PlatformFilesystemSnapshot::resetForTesting();
        PlatformFilesystemSnapshot::capture();
        Storage::fake('modules');

        config(['moabom-system.saas.enabled' => true]);

        $tenant = new TenantRecord(
            id: 1,
            slug: 'freshent',
            host: 'freshent.mek360.com',
            dbDatabase: 'hospital_freshent',
            gcsPrefix: 'tenants/freshent',
            packageId: 'hospital-default',
            status: 'active',
            appUrl: 'https://freshent.mek360.com',
        );
        app(TenantContext::class)->setTenant($tenant, $tenant->host);
        app(TenantFilesystemConfigurator::class)->apply($tenant);

        $this->app->register(SystemServiceProvider::class);
        $this->registerRoutes();
        $this->adminUser = $this->createAdminWithSettingsPermissions();
    }

    public function test_appearance_point_color_presets_persist_under_saas(): void
    {
        $this->actingAs($this->adminUser)
            ->putJson(self::MOABOM_ADMIN_SETTINGS, [
                'appearance' => [
                    'point_color_presets' => ['#6366f1', '#a1b2c3'],
                ],
            ])
            ->assertOk();

        $presets = $this->actingAs($this->adminUser)
            ->getJson(self::MOABOM_ADMIN_SETTINGS)
            ->json('data.appearance.point_color_presets');

        $this->assertIsArray($presets);
        $this->assertContains('#a1b2c3', $presets);

        $raw = (string) Storage::disk('modules')->get('moabom-system/settings/appearance.json');
        $this->assertStringContainsString('#a1b2c3', $raw);
    }

    private function registerRoutes(): void
    {
        Route::prefix('api/modules/moabom-system')
            ->middleware(['api'])
            ->group(function (): void {
                Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function (): void {
                    Route::get('settings', [SystemSettingsController::class, 'index'])
                        ->middleware('permission:admin,moabom-system.settings.read');
                    Route::put('settings', [SystemSettingsController::class, 'store'])
                        ->middleware('permission:admin,moabom-system.settings.update');
                });
            });
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
