<?php

/**
 * Moabom 로컬 — 관리자 환경설정 drivers 카테고리에 WebSocket(Reverb) 활성 값을 기록합니다.
 *
 * G7 코어 SettingsService 경로를 사용하며, 코어 파일은 수정하지 않습니다.
 *
 * Usage (repo root):
 *   docker compose exec app php ../scripts/enable-moabom-reverb-settings.php
 */

declare(strict_types=1);

$appRoot = dirname(__DIR__).'/app';

if (! is_file($appRoot.'/vendor/autoload.php')) {
    fwrite(STDERR, "Laravel app not found at {$appRoot}\n");
    exit(1);
}

require $appRoot.'/vendor/autoload.php';

$app = require $appRoot.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

/** @var \App\Services\SettingsService $settings */
$settings = $app->make(\App\Services\SettingsService::class);

$drivers = $settings->getSettings('drivers');

$appKey = (string) (env('REVERB_APP_KEY') ?: ($drivers['websocket_app_key'] ?? ''));
if ($appKey === '') {
    $appKey = bin2hex(random_bytes(8));
}

$appSecret = (string) (env('REVERB_APP_SECRET') ?: ($drivers['websocket_app_secret'] ?? ''));
if ($appSecret === '') {
    $appSecret = bin2hex(random_bytes(16));
}

$appId = (string) (env('REVERB_APP_ID') ?: ($drivers['websocket_app_id'] ?? ''));
if ($appId === '') {
    $appId = 'moabom-local';
}

$clientHost = (string) (env('REVERB_HOST') ?: 'localhost');
$clientPort = (int) (env('REVERB_PORT') ?: 8081);
$clientScheme = (string) (env('REVERB_SCHEME') ?: 'http');

$merged = array_merge($drivers, [
    'websocket_enabled' => true,
    'websocket_app_id' => $appId,
    'websocket_app_key' => $appKey,
    'websocket_app_secret' => $appSecret,
    'websocket_host' => $clientHost,
    'websocket_port' => $clientPort,
    'websocket_scheme' => $clientScheme,
    'websocket_verify_ssl' => false,
    'websocket_server_host' => 'reverb',
    'websocket_server_port' => 8080,
    'websocket_server_scheme' => 'http',
]);

$ok = $settings->saveSettings([
    '_tab' => 'drivers',
    'drivers' => $merged,
]);

if (! $ok) {
    fwrite(STDERR, "Failed to save drivers settings.\n");
    exit(1);
}

echo "WebSocket (Reverb) enabled in admin drivers settings.\n";
echo "  client: {$clientScheme}://{$clientHost}:{$clientPort}\n";
echo "  server: http://reverb:8080 (Docker network)\n";
echo "  app_key: {$appKey}\n";
echo "Next: docker compose up -d reverb\n";
