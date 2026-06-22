<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services\Shell;

use App\Enums\UserStatus;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Contracts\ShellAppUsageRepositoryInterface;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

final class ShellRankingService
{
    private const SCOPE_APPS = 'apps';

    private const SCOPE_USERS = 'users';

    public function __construct(
        private readonly ShellAppUsageRepositoryInterface $usageRepository,
    ) {}

    /**
     * @return array{
     *   period_hours: int,
     *   generated_at: string,
     *   items: list<array{
     *     app_id: string,
     *     rank: int,
     *     change: 'up'|'down'|'same',
     *     open_hits: int,
     *     active_seconds: int,
     *     score: int
     *   }>
     * }
     */
    public function appRankings(int $limit): array
    {
        $periodHours = max(1, (int) config('moabom-system.shell_rankings.period_hours', 24));
        $limit = min(30, max(1, $limit));
        $cacheTtl = max(0, (int) config('moabom-system.shell_rankings.cache_ttl', 300));
        $cacheKey = MoabomPublicApiCacheKeys::shellAppRankings($periodHours, $limit);

        $resolver = function () use ($periodHours, $limit): array {
            return $this->buildAppRankings($periodHours, $limit);
        };

        if ($cacheTtl <= 0) {
            return $resolver();
        }

        return Cache::remember($cacheKey, $cacheTtl, $resolver);
    }

    /**
     * @return array{
     *   period_hours: int,
     *   generated_at: string,
     *   items: list<array{
     *     user_id: int,
     *     name: string,
     *     score: int,
     *     rank: int,
     *     change: 'up'|'down'|'same'
     *   }>
     * }
     */
    public function userRankings(int $limit): array
    {
        $periodHours = max(1, (int) config('moabom-system.shell_rankings.period_hours', 24));
        $limit = min(30, max(1, $limit));
        $cacheTtl = max(0, (int) config('moabom-system.shell_rankings.cache_ttl', 300));
        $cacheKey = MoabomPublicApiCacheKeys::shellUserRankings($periodHours, $limit);

        $resolver = function () use ($periodHours, $limit): array {
            return $this->buildUserRankings($periodHours, $limit);
        };

        if ($cacheTtl <= 0) {
            return $resolver();
        }

        return Cache::remember($cacheKey, $cacheTtl, $resolver);
    }

    /**
     * @return array{period_hours: int, generated_at: string, items: list<array<string, mixed>>}
     */
    private function buildAppRankings(int $periodHours, int $limit): array
    {
        $openHitWeight = max(1, (int) config('moabom-system.shell_rankings.open_hit_weight', 10));
        $since = now()->utc()->subHours($periodHours);
        $scores = $this->usageRepository->aggregateAppScores($since, $openHitWeight);
        $top = array_slice($scores, 0, $limit);

        $items = [];
        $rank = 1;
        foreach ($top as $row) {
            $appId = $row['app_id'];
            $items[] = [
                'app_id' => $appId,
                'rank' => $rank,
                'change' => 'same',
                'open_hits' => $row['open_hits'],
                'active_seconds' => $row['active_seconds'],
                'score' => $row['score'],
            ];
            $rank++;
        }

        $items = $this->applyRankingChanges(
            $items,
            self::SCOPE_APPS,
            static fn (array $item): string => (string) $item['app_id'],
        );

        return [
            'period_hours' => $periodHours,
            'generated_at' => now()->toIso8601String(),
            'items' => $items,
        ];
    }

    /**
     * @return array{period_hours: int, generated_at: string, items: list<array<string, mixed>>}
     */
    private function buildUserRankings(int $periodHours, int $limit): array
    {
        if (! Schema::hasTable('users')) {
            return [
                'period_hours' => $periodHours,
                'generated_at' => now()->toIso8601String(),
                'items' => [],
            ];
        }

        $since = now()->utc()->subHours($periodHours);
        $openHitWeight = max(1, (int) config('moabom-system.shell_rankings.open_hit_weight', 10));
        $postWeight = max(1, (int) config('moabom-system.shell_rankings.user_activity.post_weight', 50));
        $commentWeight = max(1, (int) config('moabom-system.shell_rankings.user_activity.comment_weight', 20));

        $scoreMap = $this->aggregateUserActivityScoreMap($since, $openHitWeight, $postWeight, $commentWeight);
        if ($scoreMap === []) {
            return [
                'period_hours' => $periodHours,
                'generated_at' => now()->toIso8601String(),
                'items' => [],
            ];
        }

        arsort($scoreMap);

        $items = [];
        $rank = 1;

        foreach (array_keys($scoreMap) as $userId) {
            if (count($items) >= $limit) {
                break;
            }

            $user = DB::table('users')
                ->where('id', $userId)
                ->where('status', UserStatus::Active->value)
                ->first(['id', 'nickname', 'name']);

            if ($user === null) {
                continue;
            }

            $displayName = trim((string) ($user->nickname ?: $user->name ?: ''));
            if ($displayName === '') {
                $displayName = 'User #'.$userId;
            }

            $items[] = [
                'user_id' => (int) $userId,
                'name' => $displayName,
                'score' => (int) $scoreMap[$userId],
                'rank' => $rank,
                'change' => 'same',
            ];
            $rank++;
        }

        $items = $this->applyRankingChanges(
            $items,
            self::SCOPE_USERS,
            static fn (array $item): string => (string) $item['user_id'],
        );

        return [
            'period_hours' => $periodHours,
            'generated_at' => now()->toIso8601String(),
            'items' => $items,
        ];
    }

    /**
     * @return array<int, int> user_id => activity score
     */
    private function aggregateUserActivityScoreMap(
        CarbonInterface $since,
        int $openHitWeight,
        int $postWeight,
        int $commentWeight,
    ): array {
        /** @var array<int, int> $scores */
        $scores = [];

        foreach ($this->usageRepository->aggregateUserShellScores($since, $openHitWeight) as $row) {
            $userId = (int) $row['user_id'];
            $scores[$userId] = ($scores[$userId] ?? 0) + (int) $row['shell_score'];
        }

        if (Schema::hasTable('board_posts')) {
            $posts = DB::table('board_posts')
                ->selectRaw('user_id, COUNT(*) AS post_count')
                ->whereNotNull('user_id')
                ->where('status', 'published')
                ->whereNull('deleted_at')
                ->where('created_at', '>=', $since)
                ->groupBy('user_id')
                ->get();

            foreach ($posts as $row) {
                $userId = (int) $row->user_id;
                $scores[$userId] = ($scores[$userId] ?? 0) + ((int) $row->post_count * $postWeight);
            }
        }

        if (Schema::hasTable('board_comments')) {
            $comments = DB::table('board_comments')
                ->selectRaw('user_id, COUNT(*) AS comment_count')
                ->whereNotNull('user_id')
                ->where('status', 'published')
                ->whereNull('deleted_at')
                ->where('created_at', '>=', $since)
                ->groupBy('user_id')
                ->get();

            foreach ($comments as $row) {
                $userId = (int) $row->user_id;
                $scores[$userId] = ($scores[$userId] ?? 0) + ((int) $row->comment_count * $commentWeight);
            }
        }

        return array_filter($scores, static fn (int $score): bool => $score > 0);
    }

    /**
     * 직전 집계 대비 등락 — DB 스냅샷 대신 테넌트 캐시의 이전 순위 맵을 사용한다.
     *
     * @param  list<array<string, mixed>>  $items
     * @param  callable(array<string, mixed>): string  $itemKey
     * @return list<array<string, mixed>>
     */
    private function applyRankingChanges(array $items, string $scope, callable $itemKey): array
    {
        if ($items === []) {
            return [];
        }

        $cacheKey = MoabomPublicApiCacheKeys::shellRankingsPreviousRanks($scope);
        /** @var array<string, int> $previousRanks */
        $previousRanks = Cache::get($cacheKey, []);

        foreach ($items as $index => $item) {
            $key = $itemKey($item);
            $items[$index]['change'] = $this->resolveChange(
                (int) $item['rank'],
                $previousRanks[$key] ?? null,
            );
        }

        $nextRanks = [];
        foreach ($items as $item) {
            $nextRanks[$itemKey($item)] = (int) $item['rank'];
        }

        $ttl = max(60, (int) config('moabom-system.shell_rankings.change_cache_ttl', 86400));
        Cache::put($cacheKey, $nextRanks, $ttl);

        return $items;
    }

    private function resolveChange(int $currentRank, ?int $previousRank): string
    {
        if ($previousRank === null) {
            return 'same';
        }

        if ($currentRank < $previousRank) {
            return 'up';
        }

        if ($currentRank > $previousRank) {
            return 'down';
        }

        return 'same';
    }
}
