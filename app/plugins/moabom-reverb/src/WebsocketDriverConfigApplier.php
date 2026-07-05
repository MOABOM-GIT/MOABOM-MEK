<?php

declare(strict_types=1);

namespace Plugins\Moabom\Reverb;

use Illuminate\Support\Facades\Config;

/**
 * G7 SettingsServiceProvider::applyWebsocketConfig() 와 동등한 런타임 주입.
 *
 * SaaS 테넌트/플랫폼 DB drivers 를 Laravel broadcasting·Reverb client config 로 반영한다.
 */
final class WebsocketDriverConfigApplier
{
    /**
     * @param  array<string, mixed>  $driverSettings
     */
    public static function apply(array $driverSettings): void
    {
        $driverSettings = ReverbCredentialSync::mergeEnvSecretIntoDrivers($driverSettings);
        $driverSettings = self::mergeEnvEndpointsIntoDrivers($driverSettings);

        if (empty($driverSettings['websocket_enabled'])) {
            Config::set('broadcasting.default', 'null');

            return;
        }

        $broadcastDefault = (string) config('broadcasting.default', 'reverb');
        if ($broadcastDefault === '' || $broadcastDefault === 'null') {
            $broadcastDefault = 'reverb';
        }
        Config::set('broadcasting.default', $broadcastDefault);

        $appId = $driverSettings['websocket_app_id'] ?? '';
        $appKey = $driverSettings['websocket_app_key'] ?? '';
        $appSecret = $driverSettings['websocket_app_secret'] ?? '';

        $clientHost = $driverSettings['websocket_host'] ?? '';
        $clientPort = (int) ($driverSettings['websocket_port'] ?? 0);
        $clientScheme = $driverSettings['websocket_scheme'] ?? '';
        $verifySsl = isset($driverSettings['websocket_verify_ssl'])
            ? (bool) $driverSettings['websocket_verify_ssl']
            : null;

        $serverHost = $driverSettings['websocket_server_host'] ?? '';
        $serverPort = (int) ($driverSettings['websocket_server_port'] ?? 0);
        $serverScheme = $driverSettings['websocket_server_scheme'] ?? '';
        if ($serverHost === '') {
            $serverHost = $clientHost;
        }
        if ($serverPort <= 0) {
            $serverPort = $clientPort;
        }
        if ($serverScheme === '') {
            $serverScheme = $clientScheme;
        }
        $serverUseTls = $serverScheme === 'https';

        if ($appKey !== '') {
            Config::set('broadcasting.connections.reverb.key', $appKey);
            Config::set('reverb.apps.apps.0.key', $appKey);
        }
        if ($appSecret !== '') {
            Config::set('broadcasting.connections.reverb.secret', $appSecret);
            Config::set('reverb.apps.apps.0.secret', $appSecret);
        }
        if ($appId !== '') {
            Config::set('broadcasting.connections.reverb.app_id', $appId);
            Config::set('reverb.apps.apps.0.app_id', $appId);
        }

        if ($serverHost !== '') {
            Config::set('broadcasting.connections.reverb.options.host', $serverHost);
            Config::set('reverb.apps.apps.0.options.host', $serverHost);
        }
        if ($serverPort > 0) {
            Config::set('broadcasting.connections.reverb.options.port', $serverPort);
            Config::set('reverb.apps.apps.0.options.port', $serverPort);
        }
        if ($serverScheme !== '') {
            Config::set('broadcasting.connections.reverb.options.scheme', $serverScheme);
            Config::set('broadcasting.connections.reverb.options.useTLS', $serverUseTls);
            Config::set('reverb.apps.apps.0.options.scheme', $serverScheme);
            Config::set('reverb.apps.apps.0.options.useTLS', $serverUseTls);
        }
        if ($verifySsl !== null) {
            Config::set('broadcasting.connections.reverb.client_options.verify', $verifySsl);
        }

        if ($clientHost !== '') {
            Config::set('g7.websocket.client.host', $clientHost);
        }
        if ($clientPort > 0) {
            Config::set('g7.websocket.client.port', $clientPort);
        }
        if ($clientScheme !== '') {
            Config::set('g7.websocket.client.scheme', $clientScheme);
        }
    }

    /**
     * 전용 realtime VM 등 — Run env 가 공유 WS endpoint SSOT 일 때 DB drivers endpoint 를 덮어쓴다.
     *
     * @param  array<string, mixed>  $drivers
     * @return array<string, mixed>
     */
    public static function mergeEnvEndpointsIntoDrivers(array $drivers): array
    {
        $clientHost = trim((string) env('REVERB_HOST', ''));
        if ($clientHost !== '') {
            $drivers['websocket_host'] = $clientHost;
        }

        $clientPort = env('REVERB_PORT');
        if ($clientPort !== null && $clientPort !== '') {
            $drivers['websocket_port'] = (int) $clientPort;
        }

        $clientScheme = trim((string) env('REVERB_SCHEME', ''));
        if ($clientScheme !== '') {
            $drivers['websocket_scheme'] = $clientScheme;
        }

        $serverHost = trim((string) env('REVERB_SERVER_HOST', ''));
        if ($serverHost !== '') {
            $drivers['websocket_server_host'] = $serverHost;
        }

        $serverPort = env('REVERB_SERVER_PORT');
        if ($serverPort !== null && $serverPort !== '') {
            $drivers['websocket_server_port'] = (int) $serverPort;
        }

        $serverScheme = trim((string) env('REVERB_SERVER_SCHEME', ''));
        if ($serverScheme !== '') {
            $drivers['websocket_server_scheme'] = $serverScheme;
        }

        $broadcast = trim((string) env('BROADCAST_CONNECTION', ''));
        if ($broadcast === 'reverb') {
            $drivers['websocket_enabled'] = true;
        }

        return $drivers;
    }
}
