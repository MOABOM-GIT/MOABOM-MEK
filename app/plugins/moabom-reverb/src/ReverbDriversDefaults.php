<?php

declare(strict_types=1);

namespace Plugins\Moabom\Reverb;

/**
 * 신규 테넌트·플랫폼 drivers 시드용 Reverb 기본값.
 *
 * 클라이언트 호스트만 테넌트 host 로 달라지고, 자격증명·내부 endpoint 는 env SSOT 를 따른다.
 */
final class ReverbDriversDefaults
{
    /**
     * @return array<string, mixed>
     */
    public static function forClientHost(string $clientHost): array
    {
        $cfg = config('moabom-reverb', []);

        return [
            'websocket_enabled' => true,
            'websocket_app_id' => (string) ($cfg['app_id'] ?? 'moabom-laravel'),
            'websocket_app_key' => (string) ($cfg['app_key'] ?? 'moabom-laravel-key'),
            'websocket_app_secret' => (string) ($cfg['app_secret'] ?? ''),
            'websocket_host' => $clientHost,
            'websocket_port' => (int) ($cfg['client_port'] ?? 443),
            'websocket_scheme' => (string) ($cfg['client_scheme'] ?? 'https'),
            'websocket_verify_ssl' => (bool) ($cfg['verify_ssl'] ?? true),
            'websocket_server_host' => (string) ($cfg['server_host'] ?? '127.0.0.1'),
            'websocket_server_port' => (int) ($cfg['server_port'] ?? 6001),
            'websocket_server_scheme' => (string) ($cfg['server_scheme'] ?? 'http'),
        ];
    }

    /**
     * @param  array<string, mixed>  $drivers
     * @return array<string, mixed>
     */
    public static function mergeInto(array $drivers, string $clientHost): array
    {
        return array_merge($drivers, self::forClientHost($clientHost));
    }
}
