<?php

declare(strict_types=1);

namespace Plugins\Moabom\Reverb\Tests\Unit;

use Illuminate\Support\Facades\Config;
use Plugins\Moabom\Reverb\Tests\PluginTestCase;
use Plugins\Moabom\Reverb\WebsocketDriverConfigApplier;

class WebsocketDriverConfigApplierTest extends PluginTestCase
{
    public function test_forces_null_broadcast_when_disabled(): void
    {
        Config::set('broadcasting.default', 'reverb');
        putenv('BROADCAST_CONNECTION=null');

        try {
            WebsocketDriverConfigApplier::apply([
                'websocket_enabled' => false,
            ]);

            $this->assertSame('null', config('broadcasting.default'));
        } finally {
            putenv('BROADCAST_CONNECTION');
        }
    }

    public function test_env_reverb_enables_broadcast_when_drivers_disabled(): void
    {
        Config::set('broadcasting.default', 'null');
        putenv('BROADCAST_CONNECTION=reverb');

        try {
            WebsocketDriverConfigApplier::apply([
                'websocket_enabled' => false,
                'websocket_app_key' => 'moabom-laravel-key',
                'websocket_host' => 'realtime.mek360.com',
                'websocket_port' => 443,
                'websocket_scheme' => 'https',
            ]);

            $this->assertSame('reverb', config('broadcasting.default'));
        } finally {
            putenv('BROADCAST_CONNECTION');
        }
    }

    public function test_restores_reverb_broadcast_when_enabled_after_boot_disabled_null(): void
    {
        Config::set('broadcasting.default', 'null');

        WebsocketDriverConfigApplier::apply([
            'websocket_enabled' => true,
            'websocket_app_key' => 'moabom-laravel-key',
            'websocket_host' => 'mek360.com',
            'websocket_port' => 443,
            'websocket_scheme' => 'https',
        ]);

        $this->assertSame('reverb', config('broadcasting.default'));
    }

    public function test_applies_client_and_server_endpoints_when_enabled(): void
    {
        Config::set('broadcasting.default', 'reverb');

        WebsocketDriverConfigApplier::apply([
            'websocket_enabled' => true,
            'websocket_app_id' => 'moabom-laravel',
            'websocket_app_key' => 'moabom-laravel-key',
            'websocket_app_secret' => 'secret',
            'websocket_host' => 'mosan.mek360.com',
            'websocket_port' => 443,
            'websocket_scheme' => 'https',
            'websocket_server_host' => '127.0.0.1',
            'websocket_server_port' => 6001,
            'websocket_server_scheme' => 'http',
        ]);

        $this->assertSame('reverb', config('broadcasting.default'));
        $this->assertSame('moabom-laravel-key', config('broadcasting.connections.reverb.key'));
        $this->assertSame('127.0.0.1', config('broadcasting.connections.reverb.options.host'));
        $this->assertSame(6001, config('broadcasting.connections.reverb.options.port'));
        $this->assertSame('mosan.mek360.com', config('g7.websocket.client.host'));
        $this->assertSame(443, config('g7.websocket.client.port'));
        $this->assertSame('https', config('g7.websocket.client.scheme'));
    }

    public function test_env_overrides_db_client_and_server_endpoints(): void
    {
        Config::set('broadcasting.default', 'reverb');
        putenv('REVERB_HOST=realtime.mek360.com');
        putenv('REVERB_PORT=443');
        putenv('REVERB_SCHEME=https');
        putenv('REVERB_SERVER_HOST=realtime.mek360.com');
        putenv('REVERB_SERVER_PORT=443');
        putenv('REVERB_SERVER_SCHEME=https');

        try {
            WebsocketDriverConfigApplier::apply([
                'websocket_enabled' => true,
                'websocket_app_key' => 'moabom-laravel-key',
                'websocket_host' => 'mosan.mek360.com',
                'websocket_port' => 443,
                'websocket_scheme' => 'https',
                'websocket_server_host' => '127.0.0.1',
                'websocket_server_port' => 6001,
                'websocket_server_scheme' => 'http',
            ]);

            $this->assertSame('realtime.mek360.com', config('g7.websocket.client.host'));
            $this->assertSame('realtime.mek360.com', config('broadcasting.connections.reverb.options.host'));
            $this->assertSame(443, config('broadcasting.connections.reverb.options.port'));
            $this->assertSame('https', config('broadcasting.connections.reverb.options.scheme'));
        } finally {
            putenv('REVERB_HOST');
            putenv('REVERB_PORT');
            putenv('REVERB_SCHEME');
            putenv('REVERB_SERVER_HOST');
            putenv('REVERB_SERVER_PORT');
            putenv('REVERB_SERVER_SCHEME');
        }
    }
}
