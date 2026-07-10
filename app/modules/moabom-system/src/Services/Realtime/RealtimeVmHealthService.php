<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services\Realtime;

use Illuminate\Support\Facades\Cache;
use Modules\Moabom\System\Saas\MoabomRuntimeDriverSettings;

/**
 * Realtime VM(Reverb) 공개 WebSocket probe — Cloud Run 에서 VM 경로 가용성 SSOT.
 *
 * VM 리소스·프로세스·컨테이너 지표는 VM nginx `/internal/vm-metrics` (토큰 인증) 로 수집한다.
 */
final class RealtimeVmHealthService
{
    private const CACHE_KEY = 'moabom:realtime-vm:health:v1';

    private const METRICS_CACHE_KEY = 'moabom:realtime-vm:metrics:v1';

    private const CACHE_TTL_SECONDS = 30;

    private const METRICS_CACHE_TTL_SECONDS = 15;

    private const DEFAULT_METRICS_URL = 'https://realtime.mek360.com/internal/vm-metrics';

  /**
   * @return array<string, mixed>
   */
    public function snapshot(bool $forceRefresh = false): array
    {
        if ($forceRefresh) {
            Cache::forget(self::CACHE_KEY);
            Cache::forget(self::METRICS_CACHE_KEY);
        }

        /** @var array<string, mixed> $payload */
        $payload = Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function () use ($forceRefresh): array {
            $probe = $this->probeWebSocket();

            return [
                'checked_at' => now()->toIso8601String(),
                'cached' => false,
                'overall_ok' => (bool) ($probe['ok'] ?? false),
                'plane' => 'realtime-vm',
                'config' => $this->runtimeConfig(),
                'websocket_probe' => $probe,
                'architecture' => $this->architectureFacts(),
                'vm_metrics' => $this->fetchVmMetrics($forceRefresh),
            ];
        });

        if (! $forceRefresh) {
            $payload['cached'] = true;
        }

        return $payload;
    }

    /**
     * VM 메트릭만 조회 (대시보드 경량 갱신용).
     *
     * @return array<string, mixed>
     */
    public function metricsSnapshot(bool $forceRefresh = false): array
    {
        $metrics = $this->fetchVmMetrics($forceRefresh);

        return [
            'checked_at' => now()->toIso8601String(),
            'cached' => ! $forceRefresh,
            ...$metrics,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function runtimeConfig(): array
    {
        $serverHost = (string) env('REVERB_SERVER_HOST', config('broadcasting.connections.reverb.options.host', 'realtime.mek360.com'));
        $serverScheme = (string) env('REVERB_SERVER_SCHEME', config('broadcasting.connections.reverb.options.scheme', 'https'));
        $serverPort = (int) env('REVERB_SERVER_PORT', config('broadcasting.connections.reverb.options.port', 443));

        return [
            'broadcast_connection' => MoabomRuntimeDriverSettings::effectiveBroadcastConnection(),
            'broadcast_immediate' => true,
            'client_host' => (string) env('REVERB_HOST', config('g7.websocket.client.host', 'realtime.mek360.com')),
            'client_port' => (int) env('REVERB_PORT', config('g7.websocket.client.port', 443)),
            'client_scheme' => (string) env('REVERB_SCHEME', config('g7.websocket.client.scheme', 'https')),
            'server_host' => $serverHost,
            'server_port' => $serverPort,
            'server_scheme' => $serverScheme,
            'server_publish_url' => sprintf('%s://%s:%d/apps', $serverScheme, $serverHost, $serverPort),
            'app_key' => (string) env('REVERB_APP_KEY', config('broadcasting.connections.reverb.key', 'moabom-laravel-key')),
            'app_id' => (string) env('REVERB_APP_ID', config('broadcasting.connections.reverb.app_id', 'moabom-laravel')),
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
            // 101 이후 연결이 열린 채 대기하므로 짧게 끊는다. Upgrade 확인만 목적.
            CURLOPT_TIMEOUT => 3,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => [
                'Connection: Upgrade',
                'Upgrade: websocket',
                'Sec-WebSocket-Version: 13',
                'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
            ],
        ]);

        $raw = curl_exec($handle);
        $curlError = curl_error($handle) ?: null;
        $httpStatus = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $connectMs = (int) round((float) curl_getinfo($handle, CURLINFO_CONNECT_TIME) * 1000);
        curl_close($handle);

        if ($raw === false && $curlError !== null) {
            $error = $curlError;
        }

        if (is_string($raw)) {
            $body = $raw;
        }

        $probeElapsedMs = (int) round((microtime(true) - $startedAt) * 1000);
        $pusherEstablished = str_contains($body, 'pusher:connection_established');
        // Server-side PHP curl often receives 101 without the first Pusher frame; browser wss is SSOT for frame delivery.
        $upgradeOk = $httpStatus === 101;
        $ok = $upgradeOk;

        if ($ok) {
            // 101 이후 curl 타임아웃은 PHP WS 한계 — 성공 판정 시 Error 미표시
            $error = null;
        } elseif ($error === null) {
            if ($httpStatus !== 101) {
                $error = $httpStatus > 0 ? 'http_status_'.$httpStatus : 'no_response';
            }
        }

        return [
            'ok' => $ok,
            'upgrade_ok' => $upgradeOk,
            'probe_kind' => 'server_http_upgrade',
            'host' => $host,
            'url' => $url,
            'http_status' => $httpStatus,
            'connect_ms' => $connectMs,
            'probe_elapsed_ms' => $probeElapsedMs,
            // 하위 호환 — Upgrade 성공 시 connect_ms, 실패 시 전체 경과 시간
            'latency_ms' => $upgradeOk ? $connectMs : $probeElapsedMs,
            'pusher_established' => $pusherEstablished,
            'pusher_frame_on_probe' => false,
            'browser_wss_ssot' => true,
            'note' => $upgradeOk ? 'server_upgrade_ok_browser_wss_ssot' : null,
            'error' => $error,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchVmMetrics(bool $forceRefresh): array
    {
        if ($forceRefresh) {
            Cache::forget(self::METRICS_CACHE_KEY);
        }

        /** @var array<string, mixed> $payload */
        $payload = Cache::remember(
            self::METRICS_CACHE_KEY,
            self::METRICS_CACHE_TTL_SECONDS,
            fn (): array => $this->pullVmMetricsFromAgent(),
        );

        if ($forceRefresh) {
            $payload['cached'] = false;
        } else {
            $payload['cached'] = true;
        }

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function pullVmMetricsFromAgent(): array
    {
        $url = trim((string) env('MOABOM_REALTIME_VM_METRICS_URL', self::DEFAULT_METRICS_URL));
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
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 2,
        ]);

        $body = curl_exec($handle);
        $httpStatus = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $error = curl_error($handle) ?: null;
        curl_close($handle);

        if (! is_string($body) || $body === '') {
            return [
                'available' => false,
                'reason' => 'empty_response',
                'http_status' => $httpStatus,
                'error' => $error,
            ];
        }

        if ($httpStatus === 403) {
            return [
                'available' => false,
                'reason' => 'metrics_token_rejected',
                'http_status' => $httpStatus,
            ];
        }

        if ($httpStatus < 200 || $httpStatus >= 300) {
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
            'fetched_at' => now()->toIso8601String(),
        ];
    }
}
