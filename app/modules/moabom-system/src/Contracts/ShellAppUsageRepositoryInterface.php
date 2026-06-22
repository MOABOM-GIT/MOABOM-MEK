<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Contracts;

use Carbon\CarbonInterface;

interface ShellAppUsageRepositoryInterface
{
    /**
     * @param  list<array{app_id: string, bucket_hour: CarbonInterface, open_hits: int, active_seconds: int}>  $events
     */
    public function incrementBuckets(array $events): void;

    /**
     * @param  list<array{user_id: int, bucket_hour: CarbonInterface, open_hits: int, active_seconds: int}>  $events
     */
    public function incrementUserBuckets(array $events): void;

    /**
     * @return list<array{app_id: string, open_hits: int, active_seconds: int, score: int}>
     */
    public function aggregateAppScores(CarbonInterface $since, int $openHitWeight): array;

    /**
     * @return list<array{user_id: int, open_hits: int, active_seconds: int, shell_score: int}>
     */
    public function aggregateUserShellScores(CarbonInterface $since, int $openHitWeight): array;

    /**
     * @return array<string, int>
     */
    public function loadRankMap(string $scope, CarbonInterface $bucketHour): array;

    public function storeRankSnapshot(string $scope, CarbonInterface $bucketHour, array $ranks): void;

    public function pruneOlderThan(CarbonInterface $cutoff): void;
}
