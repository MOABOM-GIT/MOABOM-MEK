<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Feature;

use App\Enums\ExtensionOwnerType;
use App\Enums\PermissionType;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Modules\Moabom\System\Http\Controllers\Admin\SystemSettingsController;
use Modules\Moabom\System\Http\Middleware\ResolveMoabomTenant;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class LegacyTenantSettingsCompatApiTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([ResolveMoabomTenant::class]);
        config(['moabom-system.saas.enabled' => false]);
        config(['moabom-system.legacy_tenant_settings_api_compat' => true]);

        $this->app->register(SystemServiceProvider::class);
        $this->registerRoutes();
    }

    public function test_legacy_tenant_settings_routes_delegate_to_admin_settings(): void
    {
        $admin = $this->createAdminWithSettingsPermissions();

        $this->actingAs($admin)
            ->getJson('/api/modules/moabom-system/admin/tenant-settings')
            ->assertOk()
            ->assertJsonStructure(['data' => ['mypage', 'appearance', 'preferences']]);

        $this->actingAs($admin)
            ->putJson('/api/modules/moabom-system/admin/tenant-settings', [
                'appearance' => [
                    'point_color_presets' => ['#112233'],
                ],
            ])
            ->assertOk();
    }

    private function registerRoutes(): void
    {
        Route::middleware(['api', 'auth:sanctum'])
            ->prefix('api/modules/moabom-system')
            ->group(function () {
                Route::get('admin/settings', [SystemSettingsController::class, 'index']);
                Route::put('admin/settings', [SystemSettingsController::class, 'store']);
                Route::get('admin/tenant-settings', [SystemSettingsController::class, 'index']);
                Route::put('admin/tenant-settings', [SystemSettingsController::class, 'store']);
            });
    }

    private function createAdminWithSettingsPermissions(): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create(['name' => 'Legacy Settings Admin']);
        $user->roles()->attach($role);

        foreach (['moabom-system.settings.read', 'moabom-system.settings.update'] as $slug) {
            $permission = Permission::query()->firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => $slug,
                    'type' => PermissionType::Admin,
                    'owner_type' => ExtensionOwnerType::Module,
                    'owner_identifier' => 'moabom-system',
                ],
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        return $user;
    }
}
