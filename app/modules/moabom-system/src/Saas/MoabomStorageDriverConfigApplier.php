<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Config;

/**
 * SettingsServiceProvider::applyStorageDriverConfig() 와 동등 — SaaS 요청 hydrator 에서 재사용.
 *
 * settings 디스크는 remap 하지 않는다 (부팅 SSOT plane 유지).
 */
final class MoabomStorageDriverConfigApplier
{
    public static function apply(string $driver): void
    {
        Config::set('filesystems.default', $driver);

        if ($driver !== 'gcs') {
            return;
        }

        $baseDisk = Config::get('filesystems.disks.gcs');
        if (! is_array($baseDisk)) {
            return;
        }

        foreach (['attachments', 'modules', 'plugins', 'public'] as $diskName) {
            Config::set("filesystems.disks.{$diskName}", self::gcsDiskConfigFor($baseDisk, $diskName));
        }

        Config::set('attachment.disk', 'attachments');
    }

    /**
     * @param  array<string, mixed>  $baseDisk
     * @return array<string, mixed>
     */
    private static function gcsDiskConfigFor(array $baseDisk, string $diskName): array
    {
        $diskConfig = $baseDisk;
        $diskConfig['path_prefix'] = $diskName;
        $diskConfig['throw'] = true;
        $diskConfig['report'] = false;
        if ($diskName === 'public') {
            $diskConfig['visibility'] = 'public';
        }

        return $diskConfig;
    }
}
