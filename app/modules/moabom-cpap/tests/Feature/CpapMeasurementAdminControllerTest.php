<?php

declare(strict_types=1);

namespace Modules\Moabom\Cpap\Tests\Feature;

use App\Enums\ExtensionOwnerType;
use App\Enums\PermissionType;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Modules\Moabom\Cpap\Models\CpapMeasurement;
use Modules\Moabom\Cpap\Tests\ModuleTestCase;

final class CpapMeasurementAdminControllerTest extends ModuleTestCase
{
    private User $adminUser;

    private const ENDPOINT = '/api/modules/moabom-cpap/admin/measurements';

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = $this->createAdminWithMeasurementReadPermission();
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson(self::ENDPOINT)->assertUnauthorized();
    }

    public function test_admin_lists_measurements(): void
    {
        $user = User::factory()->create(['name' => '측정 사용자']);
        CpapMeasurement::query()->create([
            'user_id' => $user->id,
            'profile' => ['gender' => 'male'],
            'measurements' => ['faceWidth' => 120],
            'profile_measurements' => null,
            'recommendation' => ['name' => '나잘 마스크 M', 'type' => 'nasal'],
            'mask_type' => 'nasal',
            'confidence' => 88.5,
            'metadata' => null,
        ]);

        $this->actingAs($this->adminUser)
            ->getJson(self::ENDPOINT)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.data.0.user_name', '측정 사용자')
            ->assertJsonPath('data.data.0.mask_type', 'nasal');
    }

    private function createAdminWithMeasurementReadPermission(): User
    {
        $permission = Permission::query()->firstOrCreate(
            [
                'identifier' => 'moabom-cpap.measurements.read',
                'extension_type' => ExtensionOwnerType::Module->value,
                'extension_identifier' => 'moabom-cpap',
            ],
            [
                'name' => ['ko' => '측정 목록 조회', 'en' => 'Read Measurements'],
                'type' => PermissionType::Admin->value,
            ],
        );

        $role = Role::query()->firstOrCreate(
            ['identifier' => 'admin'],
            ['name' => ['ko' => '관리자', 'en' => 'Admin']],
        );

        $role->permissions()->syncWithoutDetaching([
            $permission->id => ['permission_type' => PermissionType::Admin->value],
        ]);

        $user = User::factory()->create();
        $user->roles()->syncWithoutDetaching([$role->id]);

        return $user;
    }
}
