<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Config;

/**
 * 플랫폼 레지스트리 전용 DB 연결(테넌트 DB 스위칭 전에 사용).
 */
final class PlatformConnectionFactory
{
    public function registerConnection(): void
    {
        if (Config::has('database.connections.moabom_platform')) {
            return;
        }

        $write = SaasMysqlPdoFactory::writeSlice();
        $socket = (string) ($write['unix_socket'] ?? '');
        $host = is_array($write['host'] ?? null)
            ? (string) (($write['host'][0] ?? '127.0.0.1'))
            : (string) ($write['host'] ?? '127.0.0.1');

        Config::set('database.connections.moabom_platform', [
            'driver' => 'mysql',
            'host' => $socket !== '' ? '' : $host,
            'port' => (string) ($write['port'] ?? '3306'),
            'database' => (string) config('moabom-system.saas.platform_database', 'moabom-platform'),
            'username' => (string) ($write['username'] ?? 'root'),
            'password' => (string) ($write['password'] ?? ''),
            'unix_socket' => $socket,
            'charset' => (string) ($write['charset'] ?? 'utf8mb4'),
            'collation' => (string) ($write['collation'] ?? 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? (function_exists('moabom_mysql_pdo_options') ? moabom_mysql_pdo_options() : []) : [],
        ]);
    }
}
