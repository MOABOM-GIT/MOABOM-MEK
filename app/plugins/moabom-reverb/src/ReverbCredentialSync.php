<?php

declare(strict_types=1);

namespace Plugins\Moabom\Reverb;

use Illuminate\Support\Facades\Config;

/**
 * Reverb 서버(artisan reverb:start)와 HTTP 워커가 동일한 app key/secret 을 쓰도록
 * 부트 시점에 env·moabom-reverb SSOT 를 주입한다.
 *
 * SaaS hydrate 이전에도 reverb 프로세스가 올바른 자격증명으로 기동되어야
 * 브라우저 wss://host/app/{key} 핸드셰이크가 성공한다.
 */
final class ReverbCredentialSync
{
    public static function bootstrap(): void
    {
        $cfg = config('moabom-reverb', []);

        $appId = (string) (env('REVERB_APP_ID') ?: ($cfg['app_id'] ?? 'moabom-laravel'));
        $appKey = (string) (env('REVERB_APP_KEY') ?: ($cfg['app_key'] ?? 'moabom-laravel-key'));
        $appSecret = (string) (env('REVERB_APP_SECRET') ?: ($cfg['app_secret'] ?? ''));

        if ($appKey === '' || $appSecret === '') {
            return;
        }

        $serverHost = (string) (env('REVERB_SERVER_HOST') ?: ($cfg['server_host'] ?? '127.0.0.1'));
        $serverPort = (int) (env('REVERB_SERVER_PORT') ?: ($cfg['server_port'] ?? 6001));
        $serverScheme = (string) (env('REVERB_SERVER_SCHEME') ?: ($cfg['server_scheme'] ?? 'http'));
        $serverUseTls = $serverScheme === 'https';

        Config::set('broadcasting.connections.reverb.key', $appKey);
        Config::set('broadcasting.connections.reverb.secret', $appSecret);
        Config::set('broadcasting.connections.reverb.app_id', $appId);
        Config::set('broadcasting.connections.reverb.options.host', $serverHost);
        Config::set('broadcasting.connections.reverb.options.port', $serverPort);
        Config::set('broadcasting.connections.reverb.options.scheme', $serverScheme);
        Config::set('broadcasting.connections.reverb.options.useTLS', $serverUseTls);

        Config::set('reverb.apps.apps.0.key', $appKey);
        Config::set('reverb.apps.apps.0.secret', $appSecret);
        Config::set('reverb.apps.apps.0.app_id', $appId);
        Config::set('reverb.apps.apps.0.options.host', $serverHost);
        Config::set('reverb.apps.apps.0.options.port', $serverPort);
        Config::set('reverb.apps.apps.0.options.scheme', $serverScheme);
        Config::set('reverb.apps.apps.0.options.useTLS', $serverUseTls);

        Config::set('reverb.servers.reverb.host', $serverHost);
        Config::set('reverb.servers.reverb.port', $serverPort);
    }

    /**
     * DB drivers 에 빈 secret 이 저장된 경우 env SSOT 로 보정한다.
     *
     * @param  array<string, mixed>  $drivers
     * @return array<string, mixed>
     */
    public static function mergeEnvSecretIntoDrivers(array $drivers): array
    {
        $envSecret = trim((string) env('REVERB_APP_SECRET', ''));
        if ($envSecret === '') {
            return $drivers;
        }

        $dbSecret = trim((string) ($drivers['websocket_app_secret'] ?? ''));
        if ($dbSecret === '' || $dbSecret !== $envSecret) {
            $drivers['websocket_app_secret'] = $envSecret;
        }

        return $drivers;
    }
}
