<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Feature;

use App\Enums\ExtensionOwnerType;
use App\Enums\PermissionType;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Http\Controllers\Platform\SaasHospitalController;
use Modules\Moabom\System\Http\Middleware\ResolveMoabomTenant;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantPackageCatalog;
use Modules\Moabom\System\Saas\TenantProvisioner;
use Modules\Moabom\System\Saas\TenantProvisionerInterface;
use Modules\Moabom\System\Saas\TenantRegistry;
use Modules\Moabom\System\Saas\Deprovision\DestroyOptions;
use Modules\Moabom\System\Saas\Deprovision\DestroyResult;
use Modules\Moabom\System\Saas\Deprovision\PurgeOptions;
use Modules\Moabom\System\Saas\Deprovision\PurgeResult;
use Modules\Moabom\System\Saas\Deprovision\TenantDeprovisioner;
use Modules\Moabom\System\Saas\Deprovision\TenantDeprovisionerInterface;
use Modules\Moabom\System\Saas\Deprovision\TenantOperationLogger;
use Modules\Moabom\System\Saas\Usage\TenantUsageReporter;
use Modules\Moabom\System\Tests\ModuleTestCase;

/**
 * Platform hospitals API — controller·권한·provisioner (Host 가드는 RequireMoabomPlatformHostTest).
 *
 * SystemServiceProvider 전체 부트는 ResolveMoabomTenant + DB::purge 로
 * DatabaseTransactions 와 충돌하므로, 컨트롤러 DI 만 최소 등록한다.
 */
class SaasHospitalControllerTest extends ModuleTestCase
{
    private User $adminUser;

    private const ENDPOINT = '/api/modules/moabom-system/platform/saas/hospitals';

    private const SLUG_AVAILABILITY_ENDPOINT = '/api/modules/moabom-system/platform/saas/hospitals/slug-availability';

    protected function setUp(): void
    {
        parent::setUp();

        // 앱 부트 시 ModuleServiceProvider 가 SystemServiceProvider 를 등록한다.
        // ResolveMoabomTenant → DB::purge 는 DatabaseTransactions 와 충돌한다.
        $this->withoutMiddleware([ResolveMoabomTenant::class]);

        $this->configureSaasPlatformDatabase();
        $this->registerControllerBindings();
        $this->registerPlatformHospitalRoutes();
        $this->adminUser = $this->createAdminWithSaasPermissions();
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson(self::ENDPOINT)->assertUnauthorized();
    }

    public function test_slug_availability_reports_reserved_system_slug(): void
    {
        $this->actingAs($this->adminUser, 'sanctum')
            ->getJson(self::SLUG_AVAILABILITY_ENDPOINT.'?slug=realtime')
            ->assertOk()
            ->assertJsonPath('data.available', false)
            ->assertJsonPath('data.host', 'realtime.mek360.com');
    }

    public function test_slug_availability_reports_existing_tenant_slug(): void
    {
        DB::connection('moabom_platform')->table('moabom_saas_tenants')->insert([
            'slug' => 'taken',
            'host' => 'taken.mek360.com',
            'display_name' => 'Taken',
            'db_database' => 'hospital_taken',
            'gcs_prefix' => 'tenants/taken',
            'package_id' => 'hospital-default',
            'status' => 'active',
            'app_url' => 'https://taken.mek360.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->adminUser, 'sanctum')
            ->getJson(self::SLUG_AVAILABILITY_ENDPOINT.'?slug=taken')
            ->assertOk()
            ->assertJsonPath('data.available', false)
            ->assertJsonFragment(['conflicts' => ['tenant_exists']]);
    }

    public function test_slug_availability_reports_available_slug(): void
    {
        $this->actingAs($this->adminUser, 'sanctum')
            ->getJson(self::SLUG_AVAILABILITY_ENDPOINT.'?slug=freshent')
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.host', 'freshent.mek360.com');
    }

    public function test_lists_hospitals_for_authorized_admin(): void
    {
        DB::connection('moabom_platform')->table('moabom_saas_tenants')->insert([
            'slug' => 'e2etest',
            'host' => 'e2etest.mek360.com',
            'display_name' => '테스트업체',
            'region' => '서울',
            'address' => '강남구 테헤란로 100',
            'db_database' => 'hospital_e2etest',
            'gcs_prefix' => 'tenants/e2etest',
            'package_id' => 'hospital-default',
            'status' => 'active',
            'app_url' => 'https://e2etest.mek360.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->adminUser)
            ->getJson(self::ENDPOINT)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.hospitals.0.slug', 'e2etest')
            ->assertJsonPath('data.hospitals.0.display_name', '테스트업체')
            ->assertJsonPath('data.hospitals.0.region', '서울')
            ->assertJsonPath('data.hospitals.0.note', '서울')
            ->assertJsonPath('data.hospitals.0.is_platform_host', false)
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.meta.base_domain', 'mek360.com')
            ->assertJsonPath('data.meta.supports_display_columns', true);
    }

    public function test_index_marks_platform_host_rows(): void
    {
        config(['moabom-system.saas.platform_hosts' => ['mek360.com', 'www.mek360.com']]);

        DB::connection('moabom_platform')->table('moabom_saas_tenants')->insert([
            [
                'slug' => 'platform',
                'host' => 'mek360.com',
                'display_name' => null,
                'region' => null,
                'address' => null,
                'db_database' => 'moabom-db',
                'gcs_prefix' => '',
                'package_id' => 'hospital-default',
                'status' => 'active',
                'app_url' => 'https://mek360.com',
                'created_at' => now()->subDay(),
                'updated_at' => now()->subDay(),
            ],
            [
                'slug' => 'freshent',
                'host' => 'freshent.mek360.com',
                'display_name' => '프레쉔트의원',
                'region' => '대구',
                'address' => null,
                'db_database' => 'hospital_freshent',
                'gcs_prefix' => 'tenants/freshent',
                'package_id' => 'hospital-default',
                'status' => 'active',
                'app_url' => 'https://freshent.mek360.com',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->actingAs($this->adminUser)
            ->getJson(self::ENDPOINT)
            ->assertOk()
            ->assertJsonPath('data.meta.total', 2);

        $hospitals = $response->json('data.hospitals');
        $platformRow = collect($hospitals)->firstWhere('slug', 'platform');
        $tenantRow = collect($hospitals)->firstWhere('slug', 'freshent');

        $this->assertSame(true, $platformRow['is_platform_host']);
        $this->assertSame(false, $tenantRow['is_platform_host']);
        $this->assertSame('freshent', $hospitals[0]['slug'], 'created_at DESC: 신규 freshent가 첫 항목');
    }

    public function test_store_delegates_to_tenant_provisioner(): void
    {
        $fake = new class implements TenantProvisionerInterface
        {
            public array $lastInput = [];

            public function provision(string $slug, array $input): array
            {
                $this->lastInput = $input;

                return [
                    'slug' => $slug,
                    'host' => $slug.'.mek360.com',
                    'database' => 'hospital_'.$slug,
                    'gcs_prefix' => 'tenants/'.$slug,
                    'app_url' => 'https://'.$slug.'.mek360.com',
                    'mode' => 'package',
                    'tables_cloned' => null,
                    'tables_bootstrapped' => 108,
                    'package_id' => 'hospital-default',
                    'display_name' => (string) ($input['name'] ?? ''),
                    'region' => (string) ($input['region'] ?? ''),
                    'note' => (string) ($input['note'] ?? ''),
                    'address' => (string) ($input['address'] ?? ''),
                ];
            }
        };
        $this->app->instance(TenantProvisionerInterface::class, $fake);

        $this->actingAs($this->adminUser)
            ->postJson(self::ENDPOINT, [
                'slug' => 'clinic99',
                'name' => '테스트업체99',
                'region' => '대구',
            ])
            ->assertCreated()
            ->assertJsonPath('data.hospital.slug', 'clinic99')
            ->assertJsonPath('data.hospital.mode', 'package')
            ->assertJsonPath('data.hospital.display_name', '테스트업체99')
            ->assertJsonPath('data.hospital.region', '대구');

        $this->assertSame('대구', $fake->lastInput['note']);
    }

    public function test_store_accepts_note_and_logo_files_without_using_region_label(): void
    {
        $fake = new class implements TenantProvisionerInterface
        {
            public array $lastInput = [];

            public function provision(string $slug, array $input): array
            {
                $this->lastInput = $input;

                return [
                    'slug' => $slug,
                    'host' => $slug.'.mek360.com',
                    'database' => 'hospital_'.$slug,
                    'gcs_prefix' => 'tenants/'.$slug,
                    'app_url' => 'https://'.$slug.'.mek360.com',
                    'mode' => 'package',
                    'tables_cloned' => null,
                    'tables_bootstrapped' => 108,
                    'package_id' => 'hospital-default',
                    'display_name' => (string) ($input['name'] ?? ''),
                    'region' => (string) ($input['region'] ?? ''),
                    'note' => (string) ($input['note'] ?? ''),
                    'address' => (string) ($input['address'] ?? ''),
                ];
            }
        };
        $this->app->instance(TenantProvisionerInterface::class, $fake);

        $this->actingAs($this->adminUser)
            ->post(self::ENDPOINT, [
                'slug' => 'clinic88',
                'name' => '테스트업체88',
                'address' => '서울시 강남구',
                'note' => '원장 메모',
                'logo_light' => UploadedFile::fake()->image('light.png'),
                'logo_dark' => UploadedFile::fake()->image('dark.png'),
            ])
            ->assertCreated()
            ->assertJsonPath('data.hospital.note', '원장 메모');

        $this->assertSame('원장 메모', $fake->lastInput['region']);
        $this->assertSame('원장 메모', $fake->lastInput['note']);
        $this->assertInstanceOf(UploadedFile::class, $fake->lastInput['logo_light']);
        $this->assertInstanceOf(UploadedFile::class, $fake->lastInput['logo_dark']);
    }

    public function test_packages_endpoint_returns_catalog(): void
    {
        $this->actingAs($this->adminUser)
            ->getJson('/api/modules/moabom-system/platform/saas/packages')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.packages.0.id', 'hospital-default');
    }

    public function test_usage_endpoint_returns_measurement(): void
    {
        DB::connection('moabom_platform')->table('moabom_saas_tenants')->insert([
            'slug' => 'freshent',
            'host' => 'freshent.mek360.com',
            'db_database' => 'hospital_freshent',
            'gcs_prefix' => 'tenants/freshent',
            'package_id' => 'hospital-default',
            'status' => 'active',
            'app_url' => 'https://freshent.mek360.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $fakeReporter = new class
        {
            public function measure(\Modules\Moabom\System\Saas\TenantRecord $tenant): array
            {
                return [
                    'slug' => $tenant->slug,
                    'database' => [
                        'name' => $tenant->dbDatabase,
                        'size_bytes' => 1024,
                        'size_human' => '1 KB',
                        'table_count' => 10,
                        'runtime_estimate_bytes' => 512,
                        'runtime_estimate_human' => '512 B',
                    ],
                    'storage' => [
                        'prefix' => 'tenants/freshent',
                        'total_bytes' => 2048,
                        'total_human' => '2 KB',
                        'by_disk' => [],
                        'provision_seed_bytes' => 100,
                        'provision_seed_human' => '100 B',
                    ],
                    'measured_at' => '2026-06-02T12:00:00Z',
                ];
            }

            public function measureSummary(\Modules\Moabom\System\Saas\TenantRecord $tenant, bool $includeStorage = true): array
            {
                return [
                    'db_size_human' => '1 KB',
                    'db_runtime_human' => '512 B',
                    'db_baseline_human' => '512 B',
                    'storage_size_human' => '2 KB',
                    'db_size_bytes' => 1024,
                    'db_runtime_bytes' => 512,
                    'db_baseline_bytes' => 512,
                    'storage_size_bytes' => 2048,
                ];
            }

            public function forgetCache(string $slug): void {}
        };
        $this->app->instance(TenantUsageReporter::class, $fakeReporter);

        $this->actingAs($this->adminUser)
            ->getJson(self::ENDPOINT.'/freshent/usage')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.database.size_bytes', 1024)
            ->assertJsonPath('data.storage.total_bytes', 2048);
    }

    public function test_purge_endpoint_delegates_to_deprovisioner(): void
    {
        DB::connection('moabom_platform')->table('moabom_saas_tenants')->insert([
            'slug' => 'clinic99',
            'host' => 'clinic99.mek360.com',
            'db_database' => 'hospital_clinic99',
            'gcs_prefix' => 'tenants/clinic99',
            'package_id' => 'hospital-default',
            'status' => 'active',
            'app_url' => 'https://clinic99.mek360.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $fake = new class implements TenantDeprovisionerInterface
        {
            public function purgeDbData(\Modules\Moabom\System\Saas\TenantRecord $tenant, PurgeOptions $options): PurgeResult
            {
                return new PurgeResult($tenant->slug, 'db_data', 42, ['tables_truncated' => 3]);
            }

            public function purgeStorageData(\Modules\Moabom\System\Saas\TenantRecord $tenant, PurgeOptions $options): PurgeResult
            {
                return new PurgeResult($tenant->slug, 'storage_data', 43, ['objects_deleted' => 9]);
            }

            public function destroy(\Modules\Moabom\System\Saas\TenantRecord $tenant, DestroyOptions $options): DestroyResult
            {
                return new DestroyResult($tenant->slug, 44, ['registry_deleted' => true]);
            }
        };
        $this->app->instance(TenantDeprovisionerInterface::class, $fake);
        $this->grantPermission('moabom-system.saas.purge');

        $this->actingAs($this->adminUser)
            ->postJson(self::ENDPOINT.'/clinic99/purge', [
                'mode' => 'storage_data',
                'confirm_slug' => 'clinic99',
            ])
            ->assertOk()
            ->assertJsonPath('data.result.mode', 'storage_data')
            ->assertJsonPath('data.result.operation_id', 43);
    }

    public function test_destroy_endpoint_delegates_to_deprovisioner(): void
    {
        DB::connection('moabom_platform')->table('moabom_saas_tenants')->insert([
            'slug' => 'clinic99',
            'host' => 'clinic99.mek360.com',
            'db_database' => 'hospital_clinic99',
            'gcs_prefix' => 'tenants/clinic99',
            'package_id' => 'hospital-default',
            'status' => 'active',
            'app_url' => 'https://clinic99.mek360.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $fake = new class implements TenantDeprovisionerInterface
        {
            public function purgeDbData(\Modules\Moabom\System\Saas\TenantRecord $tenant, PurgeOptions $options): PurgeResult
            {
                return new PurgeResult($tenant->slug, 'db_data', 1);
            }

            public function purgeStorageData(\Modules\Moabom\System\Saas\TenantRecord $tenant, PurgeOptions $options): PurgeResult
            {
                return new PurgeResult($tenant->slug, 'storage_data', 2);
            }

            public function destroy(\Modules\Moabom\System\Saas\TenantRecord $tenant, DestroyOptions $options): DestroyResult
            {
                return new DestroyResult($tenant->slug, 99, ['registry_deleted' => true]);
            }
        };
        $this->app->instance(TenantDeprovisionerInterface::class, $fake);
        $this->grantPermission('moabom-system.saas.destroy');

        $this->actingAs($this->adminUser)
            ->deleteJson(self::ENDPOINT.'/clinic99', [
                'confirm_slug' => 'clinic99',
                'confirm_host' => 'clinic99.mek360.com',
            ])
            ->assertOk()
            ->assertJsonPath('data.result.operation_id', 99);
    }

    private function grantPermission(string $identifier): void
    {
        $role = Role::where('identifier', 'admin')->firstOrFail();
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
        $this->adminUser = $this->adminUser->fresh(['roles.permissions']);
    }

    private function registerControllerBindings(): void
    {
        $this->app->singleton(PlatformConnectionFactory::class);
        $this->app->singleton(TenantRegistry::class);
        $this->app->singleton(TenantPackageCatalog::class);
        $this->app->singleton(TenantProvisionerInterface::class, TenantProvisioner::class);
        $this->app->singleton(TenantUsageReporter::class);
        $this->app->singleton(TenantDeprovisionerInterface::class, TenantDeprovisioner::class);
        $this->app->singleton(TenantOperationLogger::class);
    }

    private function registerPlatformHospitalRoutes(): void
    {
        Route::prefix('api/modules/moabom-system/platform/saas')
            ->middleware(['api', 'auth:sanctum', 'admin'])
            ->group(function (): void {
                Route::prefix('hospitals')->group(function (): void {
                    Route::get('slug-availability', [SaasHospitalController::class, 'slugAvailability'])
                        ->middleware('permission:admin,moabom-system.saas.read');
                    Route::get('/', [SaasHospitalController::class, 'index'])
                        ->middleware('permission:admin,moabom-system.saas.read');
                    Route::post('/', [SaasHospitalController::class, 'store'])
                        ->middleware('permission:admin,moabom-system.saas.create');
                    Route::get('{slug}/usage', [SaasHospitalController::class, 'usage'])
                        ->middleware('permission:admin,moabom-system.saas.read');
                    Route::post('{slug}/purge', [SaasHospitalController::class, 'purge'])
                        ->middleware('permission:admin,moabom-system.saas.purge');
                    Route::delete('{slug}', [SaasHospitalController::class, 'destroy'])
                        ->middleware('permission:admin,moabom-system.saas.destroy');
                    Route::get('{slug}/operations/{operationId}', [SaasHospitalController::class, 'operation'])
                        ->middleware('permission:admin,moabom-system.saas.read')
                        ->whereNumber('operationId');
                    Route::get('{slug}', [SaasHospitalController::class, 'show'])
                        ->middleware('permission:admin,moabom-system.saas.read');
                });

                Route::get('packages', [SaasHospitalController::class, 'packages'])
                    ->middleware('permission:admin,moabom-system.saas.read');
            });
    }

    private function configureSaasPlatformDatabase(): void
    {
        config([
            'moabom-system.saas.enabled' => true,
            'moabom-system.saas.platform_database' => 'moabom-platform',
            'database.connections.moabom_platform' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
            ],
        ]);

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            Schema::connection('moabom_platform')->create('moabom_saas_tenants', function ($table): void {
                $table->id();
                $table->string('slug', 63);
                $table->string('host', 255);
                $table->string('display_name', 200)->nullable();
                $table->string('region', 100)->nullable();
                $table->string('address', 500)->nullable();
                $table->string('db_database', 128);
                $table->string('gcs_prefix', 255)->default('');
                $table->string('package_id', 64)->default('hospital-default');
                $table->string('status', 32)->default('active');
                $table->string('app_url', 512)->nullable();
                $table->timestamps();
                $table->unique('slug');
                $table->unique('host');
                $table->index('status');
            });
        }

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenant_operations')) {
            Schema::connection('moabom_platform')->create('moabom_saas_tenant_operations', function ($table): void {
                $table->id();
                $table->string('slug', 63);
                $table->string('mode', 32);
                $table->string('status', 32)->default('running');
                $table->unsignedBigInteger('actor_user_id')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('finished_at')->nullable();
                $table->json('metrics_json')->nullable();
                $table->text('error')->nullable();
                $table->timestamps();
            });
        }
    }

    private function createAdminWithSaasPermissions(): User
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

        foreach (['moabom-system.saas.read', 'moabom-system.saas.create'] as $identifier) {
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
