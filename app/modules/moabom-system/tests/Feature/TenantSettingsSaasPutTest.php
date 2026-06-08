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
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

class TenantSettingsSaasPutTest extends ModuleTestCase
{
    private User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

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

        Route::prefix('api/modules/moabom-system/admin')
            ->middleware(['api', 'auth:sanctum', 'admin'])
            ->group(function (): void {
                Route::put('settings', [SystemSettingsController::class, 'store'])
                    ->middleware('permission:admin,moabom-system.settings.update');
                Route::get('settings', [SystemSettingsController::class, 'index'])
                    ->middleware('permission:admin,moabom-system.settings.read');
            });

        $this->adminUser = $this->createAdminWithSettingsPermissions();
    }

    public function test_appearance_only_put_replaces_point_color_presets_on_tenant_modules_disk(): void
    {
        $this->actingAs($this->adminUser)
            ->putJson('/api/modules/moabom-system/admin/settings', [
                'appearance' => [
                    'point_color_presets' => [
                        '#6366f1', '#03a94d', '#20cff4', '#3b82f6', '#17c0e4',
                        '#f69c0f', '#f657a6', '#f05d5d', '#3a5476', '#a1b2c3',
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.appearance.point_color_presets.9', '#a1b2c3');

        $this->actingAs($this->adminUser)
            ->getJson('/api/modules/moabom-system/admin/settings')
            ->assertOk()
            ->assertJsonPath('data.appearance.point_color_presets.9', '#a1b2c3');
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

        $user = User::factory()->create();
        $user->roles()->attach($role->id);

        return $user->fresh(['roles.permissions']);
    }
}
