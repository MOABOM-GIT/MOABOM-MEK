<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

final class TenantDatabaseConfigurator
{
    public function apply(TenantRecord $tenant): void
    {
        $this->activateDatabase($tenant->dbDatabase);
    }

    /**
     * default connection 의 database 만 임시 전환한 뒤 callback 을 실행하고 원래 설정으로 복원한다.
     *
     * @template T
     *
     * @param  callable(string $connection): T  $callback
     * @return T|null
     */
    public function runOnDatabase(string $database, callable $callback): mixed
    {
        if ($database === '') {
            return null;
        }

        $connection = $this->defaultConnectionName();
        $original = $this->snapshotConnectionConfig($connection);
        if ($original === null) {
            return null;
        }

        $this->activateDatabase($database);

        try {
            return $callback($connection);
        } finally {
            $this->restoreConnectionConfig($connection, $original);
        }
    }

    private function defaultConnectionName(): string
    {
        return (string) config('database.default', 'mysql');
    }

    /**
     * @return array<string, mixed>|null
     */
    private function snapshotConnectionConfig(string $connection): ?array
    {
        $config = Config::get("database.connections.{$connection}");

        return is_array($config) ? $config : null;
    }

    private function activateDatabase(string $database): void
    {
        $connection = $this->defaultConnectionName();
        $config = $this->snapshotConnectionConfig($connection);
        if ($config === null) {
            return;
        }

        Config::set("database.connections.{$connection}", $this->withDatabaseName($config, $database));
        DB::purge($connection);
        DB::reconnect($connection);
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function withDatabaseName(array $config, string $database): array
    {
        if (isset($config['write']) && is_array($config['write'])) {
            $config['write']['database'] = $database;
        }

        if (isset($config['read']) && is_array($config['read'])) {
            $config['read']['database'] = $database;
        }

        if (! isset($config['write'])) {
            $config['database'] = $database;
        }

        return $config;
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function restoreConnectionConfig(string $connection, array $config): void
    {
        Config::set("database.connections.{$connection}", $config);
        DB::purge($connection);
        DB::reconnect($connection);
    }
}
