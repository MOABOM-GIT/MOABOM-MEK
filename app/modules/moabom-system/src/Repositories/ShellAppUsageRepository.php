<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Repositories;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Contracts\ShellAppUsageRepositoryInterface;
use Modules\Moabom\System\Models\ShellRankSnapshot;

class ShellAppUsageRepository implements ShellAppUsageRepositoryInterface
{
    public function incrementBuckets(array $events): void
    {
        if ($events === [] || ! Schema::hasTable('moabom_shell_app_usage_buckets')) {
            return;
        }

        $now = now();

        foreach ($events as $event) {
            DB::table('moabom_shell_app_usage_buckets')->upsert(
                [
                    'bucket_hour' => $event['bucket_hour']->copy()->utc()->startOfHour()->format('Y-m-d H:i:s'),
                    'app_id' => $event['app_id'],
                    'open_hits' => max(0, $event['open_hits']),
                    'active_seconds' => max(0, $event['active_seconds']),
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                ['bucket_hour', 'app_id'],
                [
                    'open_hits' => DB::raw('open_hits + VALUES(open_hits)'),
                    'active_seconds' => DB::raw('active_seconds + VALUES(active_seconds)'),
                    'updated_at' => $now,
                ],
            );
        }
    }

    public function incrementUserBuckets(array $events): void
    {
        if ($events === [] || ! Schema::hasTable('moabom_shell_user_usage_buckets')) {
            return;
        }

        $now = now();

        foreach ($events as $event) {
            DB::table('moabom_shell_user_usage_buckets')->upsert(
                [
                    'user_id' => $event['user_id'],
                    'bucket_hour' => $event['bucket_hour']->copy()->utc()->startOfHour()->format('Y-m-d H:i:s'),
                    'open_hits' => max(0, $event['open_hits']),
                    'active_seconds' => max(0, $event['active_seconds']),
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                ['user_id', 'bucket_hour'],
                [
                    'open_hits' => DB::raw('open_hits + VALUES(open_hits)'),
                    'active_seconds' => DB::raw('active_seconds + VALUES(active_seconds)'),
                    'updated_at' => $now,
                ],
            );
        }
    }

    public function aggregateAppScores(?CarbonInterface $since, int $openHitWeight): array
    {
        if (! Schema::hasTable('moabom_shell_app_usage_buckets')) {
            return [];
        }

        $query = DB::table('moabom_shell_app_usage_buckets')
            ->selectRaw(
                'app_id, SUM(open_hits) AS open_hits, SUM(active_seconds) AS active_seconds, '
                .'((SUM(open_hits) * ?) + SUM(active_seconds)) AS score',
                [$openHitWeight],
            );

        if ($since !== null) {
            $query->where('bucket_hour', '>=', $since->copy()->utc());
        }

        $rows = $query
            ->groupBy('app_id')
            ->orderByDesc('score')
            ->orderBy('app_id')
            ->get();

        return $rows->map(static fn ($row): array => [
            'app_id' => (string) $row->app_id,
            'open_hits' => (int) $row->open_hits,
            'active_seconds' => (int) $row->active_seconds,
            'score' => (int) $row->score,
        ])->all();
    }

    public function aggregateUserShellScores(CarbonInterface $since, int $openHitWeight): array
    {
        if (! Schema::hasTable('moabom_shell_user_usage_buckets')) {
            return [];
        }

        $rows = DB::table('moabom_shell_user_usage_buckets')
            ->selectRaw(
                'user_id, SUM(open_hits) AS open_hits, SUM(active_seconds) AS active_seconds, '
                .'((SUM(open_hits) * ?) + SUM(active_seconds)) AS shell_score',
                [$openHitWeight],
            )
            ->where('bucket_hour', '>=', $since->copy()->utc())
            ->groupBy('user_id')
            ->orderByDesc('shell_score')
            ->orderBy('user_id')
            ->get();

        return $rows->map(static fn ($row): array => [
            'user_id' => (int) $row->user_id,
            'open_hits' => (int) $row->open_hits,
            'active_seconds' => (int) $row->active_seconds,
            'shell_score' => (int) $row->shell_score,
        ])->all();
    }

    public function loadRankMap(string $scope, CarbonInterface $bucketHour): array
    {
        if (! Schema::hasTable('moabom_shell_rank_snapshots')) {
            return [];
        }

        $snapshot = ShellRankSnapshot::query()
            ->where('scope', $scope)
            ->where('bucket_hour', $bucketHour->copy()->utc()->startOfHour())
            ->value('ranks');

        return is_array($snapshot) ? array_map('intval', $snapshot) : [];
    }

    public function storeRankSnapshot(string $scope, CarbonInterface $bucketHour, array $ranks): void
    {
        if (! Schema::hasTable('moabom_shell_rank_snapshots')) {
            return;
        }

        ShellRankSnapshot::query()->updateOrCreate(
            [
                'scope' => $scope,
                'bucket_hour' => $bucketHour->copy()->utc()->startOfHour(),
            ],
            [
                'ranks' => $ranks,
            ],
        );
    }

    public function pruneOlderThan(CarbonInterface $cutoff): void
    {
        if (Schema::hasTable('moabom_shell_app_usage_buckets')) {
            DB::table('moabom_shell_app_usage_buckets')
                ->where('bucket_hour', '<', $cutoff->copy()->utc())
                ->delete();
        }

        if (Schema::hasTable('moabom_shell_rank_snapshots')) {
            DB::table('moabom_shell_rank_snapshots')
                ->where('bucket_hour', '<', $cutoff->copy()->utc())
                ->delete();
        }

        if (Schema::hasTable('moabom_shell_user_usage_buckets')) {
            DB::table('moabom_shell_user_usage_buckets')
                ->where('bucket_hour', '<', $cutoff->copy()->utc())
                ->delete();
        }
    }
}
