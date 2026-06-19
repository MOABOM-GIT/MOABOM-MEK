<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Modules\Moabom\System\Saas\TenantIdentityBootstrapper;
use Modules\Moabom\System\Saas\TenantLocalStorageEnsurer;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

class TenantIdentityBootstrapperTest extends ModuleTestCase
{
    public function test_bootstrap_copies_roles_and_admin_user_from_source_db(): void
    {
        $sourceDb = 'moabom-db';
        $targetDb = 'hospital_identity_test_'.bin2hex(random_bytes(4));

        $cloner = app(\Modules\Moabom\System\Saas\TenantDatabaseCloner::class);
        $cloner->createDatabaseIfNotExists($targetDb);
        $cloner->cloneSchemaOnly($sourceDb, $targetDb);

        $bootstrapper = app(TenantIdentityBootstrapper::class);
        $bootstrapper->bootstrap($sourceDb, $targetDb, 'admin@mek360.com');

        config(['database.connections.mysql.database' => $targetDb]);
        \Illuminate\Support\Facades\DB::purge('mysql');
        \Illuminate\Support\Facades\DB::reconnect('mysql');

        $this->assertGreaterThan(0, \App\Models\Role::query()->where('identifier', 'admin')->count());
        $this->assertGreaterThan(0, \App\Models\User::query()->where('email', 'admin@mek360.com')->count());

        $admin = \App\Models\User::query()->where('email', 'admin@mek360.com')->firstOrFail();
        $this->assertTrue($admin->roles()->where('identifier', 'admin')->exists());

        $pdo = $cloner->pdo();
        $pdo->exec('DROP DATABASE IF EXISTS `'.$targetDb.'`');
    }

    public function test_local_storage_ensurer_creates_writable_tenant_directories(): void
    {
        config([
            'filesystems.disks.settings' => [
                'driver' => 'local',
                'root' => storage_path('app/settings'),
            ],
        ]);

        $slug = 'storagetest'.bin2hex(random_bytes(3));
        $tenant = new TenantRecord(
            id: 1,
            slug: $slug,
            host: "{$slug}.mek360.com",
            dbDatabase: 'hospital_'.$slug,
            gcsPrefix: 'tenants/'.$slug,
            packageId: 'hospital-default',
            status: 'provisioning',
            appUrl: "https://{$slug}.mek360.com",
        );

        $root = storage_path('app/tenants/'.$slug);
        if (is_dir($root)) {
            $this->removeDirectory($root);
        }

        app(TenantLocalStorageEnsurer::class)->ensure($tenant);

        $this->assertDirectoryExists($root.'/settings');
        $this->assertTrue(is_writable($root.'/settings'));

        $this->removeDirectory($root);
    }

    private function removeDirectory(string $path): void
    {
        if (! is_dir($path)) {
            return;
        }

        $items = scandir($path);
        if ($items === false) {
            return;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $full = $path.'/'.$item;
            if (is_dir($full)) {
                $this->removeDirectory($full);
            } else {
                @unlink($full);
            }
        }

        @rmdir($path);
    }
}
