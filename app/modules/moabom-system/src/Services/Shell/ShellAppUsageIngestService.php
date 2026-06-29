<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services\Shell;

use App\Extension\HookManager;
use Carbon\CarbonInterface;
use Modules\Moabom\System\Contracts\ShellAppUsageRepositoryInterface;

final class ShellAppUsageIngestService
{
    public function __construct(
        private readonly ShellAppUsageRepositoryInterface $usageRepository,
    ) {}

    /**
     * @param  list<array{app_id: string, bucket_hour?: string|null, open_hits?: int, active_seconds?: int}>  $events
     */
    public function ingest(array $events, ?int $userId = null): int
    {
        $maxOpenHits = (int) config('moabom-system.shell_rankings.max_open_hits_per_event', 5);
        $maxActiveSeconds = (int) config('moabom-system.shell_rankings.max_active_seconds_per_event', 1800);
        $maxEvents = (int) config('moabom-system.shell_rankings.max_events_per_request', 20);

        $normalized = [];

        foreach (array_slice($events, 0, $maxEvents) as $event) {
            $appId = trim((string) ($event['app_id'] ?? ''));
            if (! $this->isValidAppId($appId)) {
                continue;
            }

            if (! (bool) HookManager::applyFilters('moabom.shell_rankings.allow_app_usage_ingest', true, $appId)) {
                continue;
            }

            $bucketHour = $this->parseBucketHour($event['bucket_hour'] ?? null);
            $openHits = min($maxOpenHits, max(0, (int) ($event['open_hits'] ?? 0)));
            $activeSeconds = min($maxActiveSeconds, max(0, (int) ($event['active_seconds'] ?? 0)));

            if ($openHits === 0 && $activeSeconds === 0) {
                continue;
            }

            $normalized[] = [
                'app_id' => $appId,
                'bucket_hour' => $bucketHour,
                'open_hits' => $openHits,
                'active_seconds' => $activeSeconds,
            ];
        }

        if ($normalized === []) {
            return 0;
        }

        $this->usageRepository->incrementBuckets($normalized);

        return count($normalized);
    }

    private function isValidAppId(string $appId): bool
    {
        if ($appId === '' || strlen($appId) > 128) {
            return false;
        }

        if (str_starts_with($appId, 'moa-shell-')) {
            return false;
        }

        return (bool) preg_match('/^[a-z0-9][a-z0-9-]*$/', $appId);
    }

    private function parseBucketHour(?string $value): CarbonInterface
    {
        if (is_string($value) && $value !== '') {
            try {
                return now()->parse($value)->utc()->startOfHour();
            } catch (\Throwable) {
            }
        }

        return now()->utc()->startOfHour();
    }
}
