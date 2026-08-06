<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

/**
 * mek360.com 플랫폼 Host 요청 시 DB·GCS 를 테넌트 오염 없이 기본(moabom-db, prefix 없음)으로 복원.
 */
final class PlatformRuntimeConfigurator
{
    private readonly string $connectionName;

    /** @var array<string, mixed>|null */
    private readonly ?array $platformConnectionConfig;

    public function __construct(
        private readonly PlatformFilesystemSnapshot $filesystemSnapshot,
    ) {
        $this->connectionName = (string) config('database.default', 'mysql');
        $config = Config::get("database.connections.{$this->connectionName}");
        $this->platformConnectionConfig = is_array($config) ? $config : null;
    }

    public function applyPlatform(): void
    {
        $this->applyPlatformDatabase();
        $this->filesystemSnapshot->restorePlatformDisks();
    }

    private function applyPlatformDatabase(): void
    {
        $connection = $this->connectionName;
        $config = $this->platformConnectionConfig;
        if ($config === null) {
            return;
        }

        $platformDb = SaasMysqlPdoFactory::platformWriteDatabase();
        $readDb = (string) ($config['read']['database'] ?? $platformDb);

        if (isset($config['write']) && is_array($config['write'])) {
            $config['write']['database'] = $platformDb;
        }

        if (isset($config['read']) && is_array($config['read'])) {
            $config['read']['database'] = $readDb;
        }

        if (! isset($config['write'])) {
            $config['database'] = $platformDb;
        }

        $current = Config::get("database.connections.{$connection}");
        if ($current === $config) {
            return;
        }

        $manager = DB::getFacadeRoot();
        $connectionAlreadyResolved = is_object($manager)
            && method_exists($manager, 'getConnections')
            && array_key_exists($connection, $manager->getConnections());

        Config::set("database.connections.{$connection}", $config);
        if ($connectionAlreadyResolved) {
            DB::purge($connection);
        }
    }
}
