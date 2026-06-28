<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Modules\Moabom\Apps\Contracts\AppCommunityPostRepositoryInterface;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;

/**
 * 앱 이야기 집계 캐시 SSOT.
 */
class AppCommunityStatsService
{
    public function __construct(
        private readonly AppCommunityPostRepositoryInterface $postRepository,
    ) {}

    public function recalculate(int $generatedAppId): void
    {
        if ($generatedAppId <= 0) {
            return;
        }

        $stats = $this->postRepository->aggregatePublishedStats($generatedAppId);

        GeneratedAppsConnection::apps()
            ->whereKey($generatedAppId)
            ->update([
                'community_rating_avg' => $stats['rating_avg'],
                'community_rating_count' => $stats['rating_count'],
                'community_post_count' => $stats['post_count'],
            ]);
    }
}
