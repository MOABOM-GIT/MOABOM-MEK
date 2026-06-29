<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Config;

/**
 * Cloud Run 운영 env 가 SSOT 인 드라이버 값을 관리자 settings 와 맞춘다.
 *
 * G7 core drivers 탭은 DB 설정을 저장하지만, Cloud Run 에서는 cache/session/queue/log
 * 같은 인프라 드라이버가 env/config 로 고정된다. 관리자 UI 와 실제 런타임이 다르면
 * 운영자가 잘못된 상태를 보게 되므로 DB payload 를 읽고 저장할 때 운영값으로 보정한다.
 */
final class MoabomRuntimeDriverSettings
{
    /**
     * @param  array<string, mixed>  $drivers
     * @return array<string, mixed>
     */
    public static function normalize(array $drivers): array
    {
        $drivers['storage_driver'] = self::stringValue(env('FILESYSTEM_DISK'), self::stringValue(config('filesystems.default'), 'gcs'));
        $drivers['cache_driver'] = self::stringValue(env('CACHE_STORE'), self::stringValue(config('cache.default'), 'file'));
        if ($drivers['cache_driver'] === 'redis') {
            $drivers['redis_host'] = self::stringValue(config('database.redis.cache.host'), '127.0.0.1');
            $drivers['redis_port'] = self::intValue(config('database.redis.cache.port'), 6379);
            $drivers['redis_database'] = self::intValue(config('database.redis.cache.database'), 1);
        }
        $drivers['session_driver'] = self::stringValue(env('SESSION_DRIVER'), self::stringValue(config('session.driver'), 'cookie'));
        $drivers['queue_driver'] = self::stringValue(env('QUEUE_CONNECTION'), self::stringValue(config('queue.default'), 'database'));
        $drivers['log_driver'] = self::stringValue(env('LOG_CHANNEL'), self::stringValue(config('logging.default'), 'stderr'));
        $drivers['log_level'] = self::stringValue(
            config('logging.channels.'.$drivers['log_driver'].'.level'),
            self::stringValue(env('LOG_LEVEL'), 'warning'),
        );

        $drivers['websocket_enabled'] = self::stringValue(config('broadcasting.default'), 'reverb') === 'reverb';
        $drivers['websocket_app_id'] = self::stringValue(env('REVERB_APP_ID'), self::stringValue(config('broadcasting.connections.reverb.app_id'), 'moabom-laravel'));
        $drivers['websocket_app_key'] = self::stringValue(env('REVERB_APP_KEY'), self::stringValue(config('broadcasting.connections.reverb.key'), 'moabom-laravel-key'));
        $drivers['websocket_host'] = self::stringValue(env('REVERB_HOST'), self::stringValue(config('g7.websocket.client.host'), 'realtime.mek360.com'));
        $drivers['websocket_port'] = self::intValue(env('REVERB_PORT'), self::intValue(config('g7.websocket.client.port'), 443));
        $drivers['websocket_scheme'] = self::stringValue(env('REVERB_SCHEME'), self::stringValue(config('g7.websocket.client.scheme'), 'https'));
        $drivers['websocket_verify_ssl'] = filter_var(env('REVERB_VERIFY_SSL', true), FILTER_VALIDATE_BOOL);
        $drivers['websocket_server_host'] = self::stringValue(env('REVERB_SERVER_HOST'), self::stringValue(config('broadcasting.connections.reverb.options.host'), $drivers['websocket_host']));
        $drivers['websocket_server_port'] = self::intValue(env('REVERB_SERVER_PORT'), self::intValue(config('broadcasting.connections.reverb.options.port'), $drivers['websocket_port']));
        $drivers['websocket_server_scheme'] = self::stringValue(env('REVERB_SERVER_SCHEME'), self::stringValue(config('broadcasting.connections.reverb.options.scheme'), $drivers['websocket_scheme']));

        $drivers['_runtime'] = [
            'locked' => true,
            'source' => 'cloud-run-env',
            'plane' => 'realtime-vm',
            'keys' => [
                'storage_driver',
                'cache_driver',
                'redis_host',
                'redis_port',
                'redis_database',
                'session_driver',
                'queue_driver',
                'log_driver',
                'log_level',
                'websocket_enabled',
                'websocket_app_id',
                'websocket_app_key',
                'websocket_host',
                'websocket_port',
                'websocket_scheme',
                'websocket_verify_ssl',
                'websocket_server_host',
                'websocket_server_port',
                'websocket_server_scheme',
            ],
        ];

        return $drivers;
    }

    private static function stringValue(mixed $value, string $fallback = ''): string
    {
        if (is_string($value) && $value !== '') {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        return $fallback;
    }

    private static function intValue(mixed $value, int $fallback): int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return $fallback;
    }
}
