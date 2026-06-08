<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

final class TenantDatabaseConfigurator
{
    public function apply(TenantRecord $tenant): void
    {
        $connection = (string) config('database.default', 'mysql');
        $config = Config::get("database.connections.{$connection}");

        if (! is_array($config)) {
            return;
        }

        if (isset($config['write']) && is_array($config['write'])) {
            $config['write']['database'] = $tenant->dbDatabase;
        }

        if (isset($config['read']) && is_array($config['read'])) {
            $config['read']['database'] = $tenant->dbDatabase;
        }

        if (! isset($config['write'])) {
            $config['database'] = $tenant->dbDatabase;
        }

        Config::set("database.connections.{$connection}", $config);
        DB::purge($connection);
        DB::reconnect($connection);
    }
}
