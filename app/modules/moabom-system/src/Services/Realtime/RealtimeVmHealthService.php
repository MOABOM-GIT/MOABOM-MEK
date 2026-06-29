<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services\Realtime;

use Illuminate\Support\Facades\Cache;

/**
 * Realtime VM(Reverb) 공개 WebSocket probe — Cloud Run 에서 VM 경로 가용성 SSOT.
 *
 * SSH·docker stats 는 운영자 WSL/VM 에서만 가능하므로 HTTP 101 upgrade + Pusher handshake 만 검증한다.
 */
final class RealtimeVmHealthService
{
    private const CACHE_KEY = 'moabom:realtime-vm:health:v1';

    private const CACHE_TTL_SECONDS = 30;

  /**
   * @return array<string, mixed>
   */
    public function snapshot(bool $forceRefresh = false): array
    {
        if ($forceRefresh) {
            Cache::forget(self::CACHE_KEY);
        }

        /** @var array<string, mixed> $payload */
        $payload = Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function (): array {
            $probe = $this->probeWebSocket();

            return [
                'checked_at' => now()->toIso8601String(),
                'cached' => false,
                'overall_ok' => (bool) ($probe['ok'] ?? false),
                'plane' => 'realtime-vm',
                'config' => $this->runtimeConfig(),
                'websocket_probe' => $probe,
                'architecture' => $this->architectureFacts(),
                'vm_metrics' => $this->fetchVmMetrics(),
            ];
        });

        if (! $forceRefresh) {
            $payload['cached'] = true;
        }

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function runtimeConfig(): array
    {
        return [
            'broadcast_connection' => (string) config('broadcasting.default', 'null'),
            'broadcast_immediate' => true,
            'client_host' => (string) env('REVERB_HOST', config('g7.websocket.client.host', 'realtime.mek360.com')),
            'client_port' => (int) env('REVERB_PORT', config('g7.websocket.client.port', 443)),
            'client_scheme' => (string) env('REVERB_SCHEME', config('g7.websocket.client.scheme', 'https')),
            'server_host' => (string) env('REVERB_SERVER_HOST', config('broadcasting.connections.reverb.options.host', 'realtime.mek360.com')),
            'server_port' => (int) env('REVERB_SERVER_PORT', config('broadcasting.connections.reverb.options.port', 443)),
            'server_scheme' => (string) env('REVERB_SERVER_SCHEME', config('broadcasting.connections.reverb.options.scheme', 'https')),
            'app_key' => (string) env('REVERB_APP_KEY', config('broadcasting.connections.reverb.key', 'moabom-laravel-key')),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function architectureFacts(): array
    {
        return [
            'vm_name' => 'moabom-realtime-prod',
            'vm_public_ip' => '34.50.62.24',
            'vm_internal_ip' => '10.178.0.4',
            'dns_host' => 'realtime.mek360.com',
            'cloud_run_publish' => 'Laravel ShouldBroadcastNow → Reverb HTTP API',
            'health_script' => 'deploy/check-realtime-vm-health.sh',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function probeWebSocket(): array
    {
        $host = (string) env('REVERB_HOST', 'realtime.mek360.com');
        $appKey = (string) env('REVERB_APP_KEY', 'moabom-laravel-key');
        $scheme = (string) env('REVERB_SCHEME', 'https');
        $url = sprintf(
            '%s://%s/app/%s?protocol=7&client=js&version=8.4.0&flash=false',
            $scheme === 'http' ? 'http' : 'https',
            $host,
            rawurlencode($appKey),
        );

        $startedAt = microtime(true);
        $httpStatus = 0;
        $body = '';
        $error = null;

        if (! function_exists('curl_init')) {
            return [
                'ok' => false,
                'host' => $host,
                'url' => $url,
                'http_status' => 0,
                'latency_ms' => 0,
                'pusher_established' => false,
                'error' => 'curl_unavailable',
            ];
        }

        $handle = curl_init($url);
        if ($handle === false) {
            return [
                'ok' => false,
                'host' => $host,
                'url' => $url,
                'http_status' => 0,
                'latency_ms' => 0,
                'pusher_established' => false,
                'error' => 'curl_init_failed',
            ];
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_HTTPHEADER => [
                'Connection: Upgrade',
                'Upgrade: websocket',
                'Sec-WebSocket-Version: 13',
                'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
            ],
        ]);

        $raw = curl_exec($handle);
        if ($raw === false) {
            $error = curl_error($handle) ?: 'curl_exec_failed';
        }
        $httpStatus = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        curl_close($handle);

        if (is_string($raw)) {
            $body = $raw;
        }

        $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);
        $pusherEstablished = str_contains($body, 'pusher:connection_established');
        $ok = $httpStatus === 101 && $pusherEstablished;

        return [
            'ok' => $ok,
            'host' => $host,
            'url' => $url,
            'http_status' => $httpStatus,
            'latency_ms' => $latencyMs,
            'pusher_established' => $pusherEstablished,
            'error' => $error,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchVmMetrics(): array
    {
        $url = trim((string) env('MOABOM_REALTIME_VM_METRICS_URL', ''));
        if ($url === '' || ! function_exists('curl_init')) {
            return [
                'available' => false,
                'reason' => 'metrics_url_unconfigured',
            ];
        }

        $token = trim((string) env('MOABOM_REALTIME_VM_METRICS_TOKEN', ''));
        $headers = ['Accept: application/json'];
        if ($token !== '') {
            $headers[] = 'X-Moabom-Metrics-Token: '.$token;
        }

        $handle = curl_init($url);
        if ($handle === false) {
            return ['available' => false, 'reason' => 'curl_init_failed'];
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_HTTPHEADER => $headers,
        ]);

        $body = curl_exec($handle);
        $httpStatus = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $error = curl_error($handle) ?: null;
        curl_close($handle);

        if (! is_string($body) || $body === '' || $httpStatus < 200 || $httpStatus >= 300) {
            return [
                'available' => false,
                'reason' => 'fetch_failed',
                'http_status' => $httpStatus,
                'error' => $error,
            ];
        }

        try {
            /** @var array<string, mixed> $decoded */
            $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return ['available' => false, 'reason' => 'invalid_json'];
        }

        return [
            'available' => true,
            'data' => $decoded,
        ];
    }
}
