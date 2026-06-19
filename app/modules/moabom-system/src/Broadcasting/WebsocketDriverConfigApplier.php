<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Broadcasting;

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
        if (empty($driverSettings['websocket_enabled'])) {
            Config::set('broadcasting.default', 'null');

            return;
        }

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
}
