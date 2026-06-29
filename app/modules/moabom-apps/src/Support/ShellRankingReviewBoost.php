<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;

/**
 * 앱 순위 — 커뮤니티 별점 가중치 병합.
 */
final class ShellRankingReviewBoost
{
    /**
     * @param  list<array{app_id: string, open_hits?: int, active_seconds?: int, score?: int}>  $scores
     * @return list<array{app_id: string, open_hits?: int, active_seconds?: int, score?: int, review_bonus?: int}>
     */
    public function apply(array $scores): array
    {
        if ($scores === []) {
            return [];
        }

        $avgWeight = max(1, (int) config('moabom-apps.shell_rankings.review_avg_weight', 800));
        $countWeight = max(0, (int) config('moabom-apps.shell_rankings.review_count_weight', 120));
        $appIds = [];

        foreach ($scores as $row) {
            $appId = (string) ($row['app_id'] ?? '');
            if (preg_match('/^generated-app-(\d+)$/', $appId, $matches) === 1) {
                $appIds[] = (int) $matches[1];
            }
        }

        $appIds = array_values(array_unique(array_filter($appIds)));
        $ratingMap = $this->loadRatingMap($appIds);

        foreach ($scores as $index => $row) {
            $appId = (string) ($row['app_id'] ?? '');
            if (! preg_match('/^generated-app-(\d+)$/', $appId, $matches)) {
                continue;
            }

            $stats = $ratingMap[(int) $matches[1]] ?? null;
            if ($stats === null) {
                continue;
            }

            $avg = (float) $stats['avg'];
            $count = (int) $stats['count'];
            if ($count <= 0 || $avg <= 0) {
                continue;
            }

            $bonus = (int) round((($avg / 5) * $count * $avgWeight) + ($count * $countWeight));
            if ($bonus <= 0) {
                continue;
            }

            $scores[$index]['review_bonus'] = $bonus;
            $scores[$index]['score'] = (int) ($row['score'] ?? 0) + $bonus;
        }

        usort($scores, static function (array $a, array $b): int {
            $scoreCmp = ((int) ($b['score'] ?? 0)) <=> ((int) ($a['score'] ?? 0));
            if ($scoreCmp !== 0) {
                return $scoreCmp;
            }

            return strcmp((string) ($a['app_id'] ?? ''), (string) ($b['app_id'] ?? ''));
        });

        return $scores;
    }

    /**
     * @param  list<int>  $appIds
     * @return array<int, array{avg: float, count: int}>
     */
    private function loadRatingMap(array $appIds): array
    {
        if ($appIds === []) {
            return [];
        }

        GeneratedAppsConnection::register();
        $connection = GeneratedAppsConnection::usesPlatformStore()
            ? GeneratedAppsConnection::NAME
            : config('database.default');
        if (! Schema::connection($connection)->hasTable('moabom_system_generated_apps')) {
            return [];
        }

        $rows = DB::connection($connection)
            ->table('moabom_system_generated_apps')
            ->whereIn('id', $appIds)
            ->get(['id', 'community_rating_avg', 'community_rating_count']);

        $map = [];
        foreach ($rows as $row) {
            $count = (int) ($row->community_rating_count ?? 0);
            $avg = $row->community_rating_avg !== null ? (float) $row->community_rating_avg : 0.0;
            if ($count > 0 && $avg > 0) {
                $map[(int) $row->id] = ['avg' => $avg, 'count' => $count];
            }
        }

        return $map;
    }
}
