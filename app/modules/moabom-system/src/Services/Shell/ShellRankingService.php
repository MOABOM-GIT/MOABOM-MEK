<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services\Shell;

use App\Enums\UserStatus;
use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Credit\Services\CreditLevelService;
use Modules\Moabom\System\Contracts\ShellAppUsageRepositoryInterface;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

final class ShellRankingService
{
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
        $limit = min(30, max(1, $limit));
        $cacheTtl = max(0, (int) config('moabom-system.shell_rankings.cache_ttl', 300));
        $cacheKey = MoabomPublicApiCacheKeys::shellAppRankings($limit);

        $resolver = function () use ($limit): array {
            return $this->buildAppRankings($limit);
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
     *     change: 'up'|'down'|'same',
     *     level?: array<string, mixed>,
     *     is_self?: bool
     *   }>
     * }
     */
    public function userRankings(int $limit, ?User $viewer = null): array
    {
        $limit = min(30, max(1, $limit));
        $cacheTtl = max(0, (int) config('moabom-system.shell_rankings.cache_ttl', 300));
        $cacheKey = MoabomPublicApiCacheKeys::shellUserRankings($limit);

        $resolver = function () use ($limit): array {
            return $this->buildUserRankings($limit);
        };

        if ($cacheTtl <= 0) {
            $payload = $resolver();
        } else {
            $payload = Cache::remember($cacheKey, $cacheTtl, $resolver);
        }

        return $this->appendViewerSelfRow($payload, $limit, $viewer);
    }

    /**
     * @return array{period_hours: int, generated_at: string, items: list<array<string, mixed>>}
     */
    private function buildAppRankings(int $limit): array
    {
        $changePeriodHours = $this->rankingChangePeriodHours();
        $openHitWeight = max(1, (int) config('moabom-system.shell_rankings.open_hit_weight', 10));
        $scores = $this->filterAppScoreRows(
            $this->usageRepository->aggregateAppScores(null, $openHitWeight),
        );
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

        $recentRankMap = $this->buildAppRankMapForPeriod($changePeriodHours, $limit, $openHitWeight);
        $items = $this->annotateRankingChanges(
            $items,
            $recentRankMap,
            static fn (array $item): string => (string) $item['app_id'],
        );

        return [
            'period_hours' => 0,
            'change_period_hours' => $changePeriodHours,
            'generated_at' => now()->toIso8601String(),
            'items' => $items,
        ];
    }

    /**
     * @return array{period_hours: int, generated_at: string, items: list<array<string, mixed>>}
     */
    private function buildUserRankings(int $limit): array
    {
        if (! Schema::hasTable('users')) {
            return [
                'period_hours' => 0,
                'generated_at' => now()->toIso8601String(),
                'items' => [],
            ];
        }

        $rows = $this->loadCumulativeUserRankingRows($limit);
        if ($rows === []) {
            return [
                'period_hours' => 0,
                'generated_at' => now()->toIso8601String(),
                'items' => [],
            ];
        }

        $items = [];
        $rank = 1;

        foreach ($rows as $row) {
            $userId = (int) $row->id;
            $displayName = trim((string) ($row->nickname ?: $row->name ?: ''));
            if ($displayName === '') {
                $displayName = 'User #'.$userId;
            }

            $score = (int) $row->ranking_points;
            $items[] = [
                'user_id' => $userId,
                'user_uuid' => (string) $row->uuid,
                'name' => $displayName,
                'score' => $score,
                'rank' => $rank,
                'change' => 'same',
                'is_self' => false,
                'level' => $this->resolveLevelSummary($score),
            ];
            $rank++;
        }

        $items = $this->annotateRankingChanges(
            $items,
            $this->buildUserCreditRankMapForPeriod($this->rankingChangePeriodHours(), $limit),
            static fn (array $item): string => (string) $item['user_id'],
        );

        return [
            'period_hours' => 0,
            'change_period_hours' => $this->rankingChangePeriodHours(),
            'generated_at' => now()->toIso8601String(),
            'items' => $items,
        ];
    }

    /**
     * 상위 N 밖인 로그인 시청자를 목록 끝에 고정해 “사라진 것처럼” 보이는 UX를 완화합니다.
     *
     * @param  array{items?: list<array<string, mixed>>}  $payload
     * @return array{items: list<array<string, mixed>>}
     */
    private function appendViewerSelfRow(array $payload, int $limit, ?User $viewer): array
    {
        $items = array_values($payload['items'] ?? []);
        if ($viewer === null || ! isset($viewer->id)) {
            $payload['items'] = $items;

            return $payload;
        }

        $viewerId = (int) $viewer->id;
        foreach ($items as $index => $item) {
            if ((int) ($item['user_id'] ?? 0) === $viewerId) {
                $items[$index]['is_self'] = true;
                $payload['items'] = $items;

                return $payload;
            }
        }

        $self = $this->loadViewerRankingRow($viewerId);
        if ($self === null || (int) $self->ranking_points <= 0) {
            $payload['items'] = $items;

            return $payload;
        }

        $score = (int) $self->ranking_points;
        $rank = $this->resolveViewerAbsoluteRank($viewerId, $score);
        $displayName = trim((string) ($self->nickname ?: $self->name ?: ''));
        if ($displayName === '') {
            $displayName = 'User #'.$viewerId;
        }

        $recentMap = $this->buildUserCreditRankMapForPeriod($this->rankingChangePeriodHours(), $limit);
        $items[] = [
            'user_id' => $viewerId,
            'user_uuid' => (string) $self->uuid,
            'name' => $displayName,
            'score' => $score,
            'rank' => $rank,
            'change' => $this->resolveChangeVsRecentPeriod($rank, $recentMap[(string) $viewerId] ?? null),
            'is_self' => true,
            'level' => $this->resolveLevelSummary($score),
        ];

        $payload['items'] = $items;
        $payload['viewer_outside_top'] = true;

        return $payload;
    }

    /**
     * @return array{level: int, slug: string, progress_ratio: float}|null
     */
    private function resolveLevelSummary(int $rankingPoints): ?array
    {
        if (! class_exists(CreditLevelService::class)) {
            return null;
        }

        try {
            /** @var CreditLevelService $service */
            $service = app(CreditLevelService::class);
            $resolved = $service->resolve($rankingPoints);
        } catch (\Throwable) {
            return null;
        }

        return [
            'level' => $resolved['level'],
            'slug' => $resolved['slug'],
            'progress_ratio' => $resolved['progress_ratio'],
        ];
    }

    /**
     * @return object{id: int, uuid: string, nickname: ?string, name: ?string, ranking_points: int}|null
     */
    private function loadViewerRankingRow(int $userId): ?object
    {
        if (! Schema::hasTable('moabom_credit_balances')
            || ! Schema::hasColumn('moabom_credit_balances', 'ranking_points')) {
            return null;
        }

        $row = DB::table('moabom_credit_balances as b')
            ->join('users as u', 'u.id', '=', 'b.user_id')
            ->where('u.id', $userId)
            ->where('u.status', UserStatus::Active->value)
            ->first([
                'u.id',
                'u.uuid',
                'u.nickname',
                'u.name',
                'b.ranking_points',
            ]);

        return $row ?: null;
    }

    private function resolveViewerAbsoluteRank(int $userId, int $score): int
    {
        if (! Schema::hasTable('moabom_credit_balances')
            || ! Schema::hasColumn('moabom_credit_balances', 'ranking_points')) {
            return 1;
        }

        $ahead = (int) DB::table('moabom_credit_balances as b')
            ->join('users as u', 'u.id', '=', 'b.user_id')
            ->where('u.status', UserStatus::Active->value)
            ->where('b.ranking_points', '>', 0)
            ->where(function ($query) use ($score, $userId): void {
                $query->where('b.ranking_points', '>', $score)
                    ->orWhere(function ($tie) use ($score, $userId): void {
                        $tie->where('b.ranking_points', '=', $score)
                            ->where('u.id', '<', $userId);
                    });
            })
            ->count();

        return $ahead + 1;
    }

    /**
     * @return list<object{id: int, uuid: string, nickname: ?string, name: ?string, ranking_points: int}>
     */
    private function loadCumulativeUserRankingRows(int $limit): array
    {
        if (Schema::hasTable('moabom_credit_balances')
            && Schema::hasColumn('moabom_credit_balances', 'ranking_points')) {
            return DB::table('moabom_credit_balances as b')
                ->join('users as u', 'u.id', '=', 'b.user_id')
                ->where('u.status', UserStatus::Active->value)
                ->where('b.ranking_points', '>', 0)
                ->orderByDesc('b.ranking_points')
                ->orderBy('u.id')
                ->limit($limit)
                ->get([
                    'u.id',
                    'u.uuid',
                    'u.nickname',
                    'u.name',
                    'b.ranking_points',
                ])
                ->all();
        }

        $scoreMap = $this->aggregateLifetimeUserCreditScoreMap();
        if ($scoreMap === []) {
            return [];
        }

        arsort($scoreMap);
        $userIds = array_slice(array_keys($scoreMap), 0, $limit);
        if ($userIds === []) {
            return [];
        }

        $users = DB::table('users')
            ->whereIn('id', $userIds)
            ->where('status', UserStatus::Active->value)
            ->get(['id', 'uuid', 'nickname', 'name'])
            ->keyBy('id');

        $rows = [];
        foreach ($userIds as $userId) {
            $user = $users->get($userId);
            if ($user === null) {
                continue;
            }

            $rows[] = (object) [
                'id' => (int) $user->id,
                'uuid' => (string) $user->uuid,
                'nickname' => $user->nickname,
                'name' => $user->name,
                'ranking_points' => (int) $scoreMap[$userId],
            ];
        }

        return $rows;
    }

    /**
     * 마이그레이션 전 폴백 — 적립 이벤트 원장 누적 합.
     *
     * @return array<int, int> user_id => earned credit sum
     */
    private function aggregateLifetimeUserCreditScoreMap(): array
    {
        if (! Schema::hasTable('moabom_credit_transactions')) {
            return [];
        }

        $sourceTypes = [
            'login',
            'post_write',
            'like_received',
            'attendance',
            'comment_write',
            'app_review_write',
        ];

        /** @var array<int, int> $scores */
        $scores = [];

        $rows = DB::table('moabom_credit_transactions')
            ->selectRaw('user_id, SUM(amount) AS score')
            ->where('type', 'earn')
            ->where('amount', '>', 0)
            ->whereNotNull('user_id')
            ->whereIn('source_type', $sourceTypes)
            ->groupBy('user_id')
            ->orderByDesc('score')
            ->get();

        foreach ($rows as $row) {
            $score = (int) $row->score;
            if ($score > 0) {
                $scores[(int) $row->user_id] = $score;
            }
        }

        return $scores;
    }

    private function rankingChangePeriodHours(): int
    {
        return max(1, (int) config('moabom-system.shell_rankings.period_hours', 24));
    }

    /**
     * @return array<string, int> app_id => rank (최근 N시간 활동 기준)
     */
    private function buildAppRankMapForPeriod(int $periodHours, int $limit, int $openHitWeight): array
    {
        $since = now()->utc()->subHours($periodHours);
        $scores = $this->filterAppScoreRows(
            $this->usageRepository->aggregateAppScores($since, $openHitWeight),
        );

        return $this->scoresToRankMap(
            $scores,
            static fn (array $row): string => (string) $row['app_id'],
            $limit * 3,
        );
    }

    /**
     * @return array<string, int> user_id => rank (최근 N시간 적립 기준)
     */
    private function buildUserCreditRankMapForPeriod(int $periodHours, int $limit): array
    {
        if (! Schema::hasTable('moabom_credit_transactions')) {
            return [];
        }

        $since = now()->utc()->subHours($periodHours);
        $sourceTypes = [
            'login',
            'post_write',
            'like_received',
            'attendance',
            'comment_write',
            'app_review_write',
        ];

        $rows = DB::table('moabom_credit_transactions')
            ->selectRaw('user_id, SUM(amount) AS score')
            ->where('type', 'earn')
            ->where('amount', '>', 0)
            ->whereNotNull('user_id')
            ->whereIn('source_type', $sourceTypes)
            ->where('created_at', '>=', $since)
            ->groupBy('user_id')
            ->orderByDesc('score')
            ->orderBy('user_id')
            ->get();

        $scores = $rows->map(static fn ($row): array => [
            'user_id' => (int) $row->user_id,
            'score' => (int) $row->score,
        ])->all();

        return $this->scoresToRankMap(
            $scores,
            static fn (array $row): string => (string) $row['user_id'],
            $limit * 3,
        );
    }

    /**
     * @param  list<array<string, mixed>>  $scores
     * @param  callable(array<string, mixed>): string  $itemKey
     * @return array<string, int>
     */
    private function scoresToRankMap(array $scores, callable $itemKey, int $maxItems): array
    {
        $rankMap = [];
        $rank = 1;

        foreach (array_slice($scores, 0, $maxItems) as $row) {
            $rankMap[$itemKey($row)] = $rank;
            $rank++;
        }

        return $rankMap;
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, int>  $previousRanks
     * @param  callable(array<string, mixed>): string  $itemKey
     * @return list<array<string, mixed>>
     */
    private function annotateRankingChanges(array $items, array $previousRanks, callable $itemKey): array
    {
        foreach ($items as $index => $item) {
            $key = $itemKey($item);
            $items[$index]['change'] = $this->resolveChangeVsRecentPeriod(
                (int) $item['rank'],
                $previousRanks[$key] ?? null,
            );
        }

        return $items;
    }

    /** 누적 순위 대비 최근 N시간 순위 — 최근이 더 좋으면 up */
    private function resolveChangeVsRecentPeriod(int $cumulativeRank, ?int $recentPeriodRank): string
    {
        if ($recentPeriodRank === null) {
            return 'same';
        }

        if ($recentPeriodRank < $cumulativeRank) {
            return 'up';
        }

        if ($recentPeriodRank > $cumulativeRank) {
            return 'down';
        }

        return 'same';
    }

    /**
     * @param  list<array{app_id: string, open_hits?: int, active_seconds?: int, score?: int}>  $scores
     * @return list<array{app_id: string, open_hits?: int, active_seconds?: int, score?: int}>
     */
    private function filterAppScoreRows(array $scores): array
    {
        return array_values((array) HookManager::applyFilters(
            'moabom.shell_rankings.filter_app_scores',
            $scores,
        ));
    }
}
