<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

/**
 * 부팅 시점 플랫폼 GCS 디스크 설정 스냅샷 (테넌트 apply 후 복원용).
 */
final class PlatformFilesystemSnapshot
{
    /** @var array<string, array<string, mixed>>|null */
    private static ?array $snapshots = null;

    /** @var array<int, string> */
    public const DISKS = [
        'attachments',
        'settings',
        'modules',
        'plugins',
        'public',
    ];

    public static function capture(): void
    {
        if (self::$snapshots !== null) {
            return;
        }

        self::$snapshots = [];
        foreach (self::DISKS as $disk) {
            $config = Config::get("filesystems.disks.{$disk}");
            if (is_array($config)) {
                self::$snapshots[$disk] = $config;
            }
        }
    }

    public function restorePlatformDisks(): void
    {
        self::capture();

        if (self::$snapshots === null) {
            return;
        }

        foreach (self::$snapshots as $disk => $config) {
            Config::set("filesystems.disks.{$disk}", $config);
            Storage::forgetDisk($disk);
        }
    }

    /**
     * @internal 테스트 전용
     */
    public static function resetForTesting(): void
    {
        self::$snapshots = null;
    }
}
