<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Apps\Events\AppCommunityRevisionBroadcastEvent;
use Modules\Moabom\Apps\Support\AppCommunityChannelNames;

/**
 * 앱 이야기 revision SSOT — admin·user mutation 후 동일 bump.
 */
final class AppCommunityRevisionService
{
    public function current(int $generatedAppId): int
    {
        return (int) Cache::get(AppCommunityChannelNames::revisionCacheKey($generatedAppId), 0);
    }

    public function bump(int $generatedAppId, string $reason = 'mutation'): int
    {
        $revision = (int) Cache::increment(AppCommunityChannelNames::revisionCacheKey($generatedAppId));

        $this->broadcastRevision(
            AppCommunityChannelNames::revisionChannel($generatedAppId),
            $generatedAppId,
            $revision,
            $reason,
        );

        return $revision;
    }

    private function broadcastRevision(string $channelName, int $generatedAppId, int $revision, string $reason): void
    {
        $driver = config('broadcasting.default');

        if (in_array($driver, ['null', 'log', null], true)) {
            return;
        }

        $connection = config("broadcasting.connections.{$driver}");
        if (empty($connection['options']['host'] ?? null)) {
            return;
        }

        try {
            broadcast(new AppCommunityRevisionBroadcastEvent(
                $channelName,
                $generatedAppId,
                $revision,
                $reason,
            ));
        } catch (\Throwable $exception) {
            Log::warning('moabom_app_community_revision_broadcast_failed', [
                'channel' => $channelName,
                'generated_app_id' => $generatedAppId,
                'revision' => $revision,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
