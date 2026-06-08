<?php

namespace Tests\Unit\Providers;

use App\Providers\SettingsServiceProvider;
use Illuminate\Support\Facades\Config;
use PHPUnit\Framework\Attributes\Test;
use ReflectionMethod;
use Tests\TestCase;

class SettingsServiceProviderStorageDriverTest extends TestCase
{
    private function callApplyStorageDriverConfig(string $driver): void
    {
        $provider = new SettingsServiceProvider($this->app);
        $method = new ReflectionMethod($provider, 'applyStorageDriverConfig');
        $method->invoke($provider, $driver);
    }

    #[Test]
    public function local_storage_driver_preserves_g7_named_file_disks(): void
    {
        Config::set('filesystems.disks.attachments.driver', 'local');
        Config::set('filesystems.disks.attachments.root', storage_path('app/attachments'));
        Config::set('filesystems.disks.modules.driver', 'local');
        Config::set('filesystems.disks.modules.root', storage_path('app/modules'));

        $this->callApplyStorageDriverConfig('local');

        $this->assertSame('local', config('filesystems.default'));
        $this->assertSame('local', config('filesystems.disks.attachments.driver'));
        $this->assertSame(storage_path('app/attachments'), config('filesystems.disks.attachments.root'));
        $this->assertSame('local', config('filesystems.disks.modules.driver'));
        $this->assertSame(storage_path('app/modules'), config('filesystems.disks.modules.root'));
    }

    #[Test]
    public function s3_storage_driver_preserves_g7_named_file_disks(): void
    {
        Config::set('filesystems.disks.s3', [
            'driver' => 's3',
            'key' => 'key',
            'secret' => 'secret',
            'region' => 'ap-northeast-2',
            'bucket' => 'bucket',
        ]);
        Config::set('filesystems.disks.attachments.driver', 'local');
        Config::set('filesystems.disks.attachments.root', storage_path('app/attachments'));
        Config::set('filesystems.disks.modules.driver', 'local');
        Config::set('filesystems.disks.modules.root', storage_path('app/modules'));

        $this->callApplyStorageDriverConfig('s3');

        $this->assertSame('s3', config('filesystems.default'));
        $this->assertSame('local', config('filesystems.disks.attachments.driver'));
        $this->assertSame(storage_path('app/attachments'), config('filesystems.disks.attachments.root'));
        $this->assertSame('local', config('filesystems.disks.modules.driver'));
        $this->assertSame(storage_path('app/modules'), config('filesystems.disks.modules.root'));
    }

    #[Test]
    public function gcs_storage_driver_updates_core_named_file_disks_with_isolated_prefixes(): void
    {
        Config::set('filesystems.disks.gcs', [
            'driver' => 'gcs',
            'project_id' => 'smartmek',
            'bucket' => 'smartmek',
            'path_prefix' => '',
            'visibility' => 'private',
        ]);

        $this->callApplyStorageDriverConfig('gcs');

        $this->assertSame('gcs', config('filesystems.default'));
        $this->assertSame('attachments', config('attachment.disk'));
        $this->assertSame('gcs', config('filesystems.disks.attachments.driver'));
        $this->assertSame('attachments', config('filesystems.disks.attachments.path_prefix'));
        $this->assertSame('gcs', config('filesystems.disks.modules.driver'));
        $this->assertSame('modules', config('filesystems.disks.modules.path_prefix'));
        $this->assertSame('gcs', config('filesystems.disks.plugins.driver'));
        $this->assertSame('plugins', config('filesystems.disks.plugins.path_prefix'));
        $this->assertSame('gcs', config('filesystems.disks.public.driver'));
        $this->assertSame('public', config('filesystems.disks.public.path_prefix'));
        $this->assertSame('public', config('filesystems.disks.public.visibility'));
    }
}
