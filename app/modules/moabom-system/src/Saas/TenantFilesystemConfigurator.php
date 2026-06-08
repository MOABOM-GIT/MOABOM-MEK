<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

final class TenantFilesystemConfigurator
{
    /** @var array<int, string> */
    private const GCS_SUFFIX_DISKS = [
        'attachments' => 'attachments',
        'settings' => 'settings',
        'modules' => 'modules',
        'plugins' => 'plugins',
        'public' => 'public',
    ];

    public function apply(TenantRecord $tenant): void
    {
        $prefix = rtrim($tenant->gcsPrefix, '/');
        if ($prefix === '') {
            $prefix = 'tenants/'.$tenant->slug;
        }

        foreach (self::GCS_SUFFIX_DISKS as $disk => $suffix) {
            if (! Config::has("filesystems.disks.{$disk}")) {
                continue;
            }

            $diskConfig = Config::get("filesystems.disks.{$disk}");
            if (! is_array($diskConfig)) {
                continue;
            }

            $driver = (string) ($diskConfig['driver'] ?? '');
            if ($driver === 'gcs') {
                $diskConfig['path_prefix'] = $prefix.'/'.$suffix;
            } elseif ($driver === 'local') {
                $diskConfig['root'] = storage_path('app/'.$prefix.'/'.$suffix);
            }

            Config::set("filesystems.disks.{$disk}", $diskConfig);
            Storage::forgetDisk($disk);
        }
    }
}
