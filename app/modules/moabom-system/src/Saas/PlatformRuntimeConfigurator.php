<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

/**
 * mek360.com 플랫폼 Host 요청 시 DB·GCS 를 테넌트 오염 없이 기본(moabom-db, prefix 없음)으로 복원.
 */
final class PlatformRuntimeConfigurator
{
    public function __construct(
        private readonly PlatformFilesystemSnapshot $filesystemSnapshot,
    ) {}

    public function applyPlatform(): void
    {
        $this->applyPlatformDatabase();
        $this->filesystemSnapshot->restorePlatformDisks();
    }

    private function applyPlatformDatabase(): void
    {
        $connection = (string) config('database.default', 'mysql');
        $config = Config::get("database.connections.{$connection}");

        if (! is_array($config)) {
            return;
        }

        $platformDb = SaasMysqlPdoFactory::platformWriteDatabase();
        $connection = (string) config('database.default', 'mysql');
        $readDb = (string) config("database.connections.{$connection}.read.database", $platformDb);

        if (isset($config['write']) && is_array($config['write'])) {
            $config['write']['database'] = $platformDb;
        }

        if (isset($config['read']) && is_array($config['read'])) {
            $config['read']['database'] = $readDb;
        }

        if (! isset($config['write'])) {
            $config['database'] = $platformDb;
        }

        Config::set("database.connections.{$connection}", $config);
        DB::purge($connection);
        DB::reconnect($connection);
    }
}
