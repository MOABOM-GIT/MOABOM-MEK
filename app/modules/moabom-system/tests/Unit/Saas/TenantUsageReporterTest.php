<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Config;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\Usage\TenantUsageReporter;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class TenantUsageReporterTest extends ModuleTestCase
{
    public function test_measure_storage_sums_local_tenant_prefix_without_disk_mutation(): void
    {
        config([
            'filesystems.disks.attachments.driver' => 'local',
            'filesystems.disks.settings.driver' => 'local',
            'filesystems.disks.modules.driver' => 'local',
            'filesystems.disks.plugins.driver' => 'local',
            'filesystems.disks.public.driver' => 'local',
        ]);

        $tenant = new TenantRecord(
            id: 1,
            slug: 'freshent',
            host: 'freshent.mek360.com',
            dbDatabase: 'hospital_freshent',
            gcsPrefix: 'tenants/freshent',
            packageId: 'hospital-default',
            status: 'active',
        );

        $attachmentsDir = storage_path('app/tenants/freshent/attachments');
        $settingsDir = storage_path('app/tenants/freshent/settings');
        @mkdir($attachmentsDir, 0777, true);
        @mkdir($settingsDir, 0777, true);

        file_put_contents($attachmentsDir.'/logo.png', str_repeat('a', 100));
        file_put_contents($settingsDir.'/site.json', str_repeat('b', 50));

        $platformPrefixBefore = (string) config('filesystems.disks.attachments.root', '');

        try {
            $usage = app(TenantUsageReporter::class)->measureStorage($tenant);

            $this->assertSame('tenants/freshent', $usage->prefix);
            $this->assertSame(150, $usage->totalBytes);
            $this->assertSame(100, $usage->byDisk['attachments']['bytes']);
            $this->assertSame(50, $usage->byDisk['settings']['bytes']);
            $this->assertSame($platformPrefixBefore, (string) config('filesystems.disks.attachments.root', ''));
        } finally {
            @unlink($attachmentsDir.'/logo.png');
            @unlink($settingsDir.'/site.json');
            @rmdir($settingsDir);
            @rmdir($attachmentsDir);
            @rmdir(dirname($attachmentsDir));
            @rmdir(dirname(dirname($attachmentsDir)));
        }
    }

    public function test_measure_summary_returns_db_even_when_storage_is_empty(): void
    {
        config([
            'filesystems.disks.attachments.driver' => 'local',
            'filesystems.disks.settings.driver' => 'local',
            'filesystems.disks.modules.driver' => 'local',
            'filesystems.disks.plugins.driver' => 'local',
            'filesystems.disks.public.driver' => 'local',
        ]);

        $tenant = new TenantRecord(
            id: 2,
            slug: 'empty-clinic',
            host: 'empty-clinic.mek360.com',
            dbDatabase: 'hospital_empty_clinic',
            gcsPrefix: 'tenants/empty-clinic',
            packageId: 'hospital-default',
            status: 'active',
        );

        $summary = app(TenantUsageReporter::class)->measureSummary($tenant, includeStorage: true);

        $this->assertSame('0 B', $summary['db_size_human']);
        $this->assertSame('0 B', $summary['db_runtime_human']);
        $this->assertSame('0 B', $summary['db_baseline_human']);
        $this->assertSame('0 B', $summary['storage_size_human']);
        $this->assertSame(0, $summary['db_size_bytes']);
        $this->assertSame(0, $summary['db_runtime_bytes']);
        $this->assertSame(0, $summary['db_baseline_bytes']);
        $this->assertSame(0, $summary['storage_size_bytes']);
    }
}
