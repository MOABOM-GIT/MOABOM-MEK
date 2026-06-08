<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use PDO;

/**
 * SaaS provision·clone Job용 MySQL PDO — config() 기반 (config:cache 후 env() 금지).
 */
final class SaasMysqlPdoFactory
{
    public static function connect(?string $database = null): PDO
    {
        $write = self::writeSlice();
        $socket = (string) ($write['unix_socket'] ?? '');
        $host = self::firstHost($write['host'] ?? '127.0.0.1');
        $port = (string) ($write['port'] ?? '3306');
        $user = (string) ($write['username'] ?? 'root');
        $pass = (string) ($write['password'] ?? '');

        $dsn = $socket !== ''
            ? "mysql:unix_socket={$socket};charset=utf8mb4"
            : "mysql:host={$host};port={$port};charset=utf8mb4";

        if ($database !== null && $database !== '') {
            $dsn .= ";dbname={$database}";
        }

        return new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function writeSlice(): array
    {
        $connection = (string) config('database.default', 'mysql');
        /** @var array<string, mixed> $config */
        $config = config("database.connections.{$connection}", []);

        $write = is_array($config['write'] ?? null) ? $config['write'] : [];
        $merged = array_merge($config, $write);

        if (! isset($merged['unix_socket']) && isset($config['unix_socket'])) {
            $merged['unix_socket'] = $config['unix_socket'];
        }

        return $merged;
    }

    public static function platformWriteDatabase(): string
    {
        $configured = trim((string) config('moabom-saas.platform_write_database', ''));
        if ($configured !== '') {
            return $configured;
        }

        $write = self::writeSlice();

        return (string) ($write['database'] ?? 'moabom-db');
    }

    private static function firstHost(mixed $host): string
    {
        if (is_array($host)) {
            $first = $host[0] ?? '127.0.0.1';

            return (string) $first;
        }

        return (string) $host;
    }
}
