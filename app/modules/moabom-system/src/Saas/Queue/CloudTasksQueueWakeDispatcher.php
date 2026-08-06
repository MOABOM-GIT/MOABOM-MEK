<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Queue;

use Illuminate\Queue\Events\JobQueued;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * DB queue의 내구성은 유지하고 Cloud Tasks가 min=0 queue service를 깨운다.
 */
final class CloudTasksQueueWakeDispatcher
{
    private ?string $accessToken = null;

    private int $accessTokenExpiresAt = 0;

    public function onJobQueued(JobQueued $event): void
    {
        if (! $this->enabled() || $event->connectionName !== 'database' || $event->id === null) {
            return;
        }

        $payload = $event->payload();
        $tenantSlug = $payload[TenantQueueBootstrapper::PAYLOAD_KEY] ?? null;

        $this->enqueue(
            is_string($tenantSlug) && $tenantSlug !== '' ? $tenantSlug : null,
            (string) ($event->queue ?: 'default'),
            (string) $event->id,
            max(0, (int) ($event->delay ?? 0)),
        );
    }

    public function enqueue(?string $tenantSlug, string $queue, string $jobId, int $delaySeconds = 0): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        $project = (string) config('moabom-system.queue_plane.project', '');
        $location = (string) config('moabom-system.queue_plane.location', '');
        $queueName = (string) config('moabom-system.queue_plane.queue', '');
        $targetUrl = (string) config('moabom-system.queue_plane.target_url', '');
        $serviceAccount = (string) config('moabom-system.queue_plane.oidc_service_account', '');
        $audience = (string) config('moabom-system.queue_plane.oidc_audience', '');
        if ($audience === '') {
            $audience = $targetUrl;
        }
        if (
            $project === ''
            || $location === ''
            || $queueName === ''
            || $targetUrl === ''
            || $serviceAccount === ''
        ) {
            Log::warning('Cloud Tasks queue wake 설정 누락');

            return false;
        }

        $scope = $tenantSlug ?: 'platform';
        $wakeAt = now()->getTimestamp() + $delaySeconds;
        $nonce = bin2hex(random_bytes(8));
        $taskId = 'job-'.substr(hash('sha256', "{$scope}|{$queue}|{$jobId}|{$wakeAt}|{$nonce}"), 0, 48);
        $parent = "projects/{$project}/locations/{$location}/queues/{$queueName}";
        $task = [
            'name' => "{$parent}/tasks/{$taskId}",
            'httpRequest' => [
                'httpMethod' => 'POST',
                'url' => $targetUrl,
                'headers' => [
                    'Content-Type' => 'application/json',
                ],
                'body' => base64_encode((string) json_encode([
                    'tenant_slug' => $tenantSlug,
                    'queue' => $queue,
                    'job_id' => $jobId,
                    'wake_at' => $wakeAt,
                ], JSON_UNESCAPED_UNICODE)),
                'oidcToken' => [
                    'serviceAccountEmail' => $serviceAccount,
                    'audience' => $audience,
                ],
            ],
            'dispatchDeadline' => '90s',
        ];
        if ($delaySeconds > 0) {
            $task['scheduleTime'] = now()->setTimestamp($wakeAt)->toRfc3339String();
        }

        try {
            $response = Http::withToken($this->metadataAccessToken())
                ->acceptJson()
                ->timeout(8)
                ->post("https://cloudtasks.googleapis.com/v2/{$parent}/tasks", [
                    'task' => $task,
                ]);

            if ($response->successful()) {
                return true;
            }

            Log::error('Cloud Tasks queue wake 생성 실패', [
                'status' => $response->status(),
                'scope' => $scope,
                'queue' => $queue,
                'job_id' => $jobId,
            ]);
        } catch (\Throwable $exception) {
            Log::error('Cloud Tasks queue wake 요청 예외', [
                'scope' => $scope,
                'queue' => $queue,
                'job_id' => $jobId,
                'error' => $exception->getMessage(),
            ]);
        }

        return false;
    }

    private function enabled(): bool
    {
        return in_array(
            (string) config('moabom-system.queue_plane.mode', 'legacy'),
            ['shadow', 'active'],
            true,
        );
    }

    private function metadataAccessToken(): string
    {
        if ($this->accessToken !== null && $this->accessTokenExpiresAt > time() + 60) {
            return $this->accessToken;
        }

        $response = Http::withHeaders(['Metadata-Flavor' => 'Google'])
            ->timeout(3)
            ->get('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token');
        $response->throw();
        $token = (string) $response->json('access_token');
        if ($token === '') {
            throw new \RuntimeException('Cloud Run metadata access token is empty.');
        }
        $this->accessTokenExpiresAt = time() + max(60, (int) $response->json('expires_in', 300));

        return $this->accessToken = $token;
    }
}
