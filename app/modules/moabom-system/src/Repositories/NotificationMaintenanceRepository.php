<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Repositories;

use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Notifications\DatabaseNotification;
use Modules\Moabom\System\Contracts\NotificationMaintenanceRepositoryInterface;

final class NotificationMaintenanceRepository implements NotificationMaintenanceRepositoryInterface
{
    public function pruneUserOverflow(int $userId, int $maxPerUser): int
    {
        return $this->pruneNotifiableOverflow(User::class, $userId, $maxPerUser);
    }

    public function cleanup(
        int $readRetentionDays,
        int $unreadRetentionDays,
        int $logRetentionDays,
        int $maxPerUser,
    ): array {
        $deletedRead = $readRetentionDays > 0
            ? DatabaseNotification::query()
                ->whereNotNull('read_at')
                ->where('read_at', '<', now()->subDays($readRetentionDays))
                ->delete()
            : 0;
        $deletedUnread = $unreadRetentionDays > 0
            ? DatabaseNotification::query()
                ->whereNull('read_at')
                ->where('created_at', '<', now()->subDays($unreadRetentionDays))
                ->delete()
            : 0;
        $deletedLogs = $logRetentionDays > 0
            ? NotificationLog::query()
                ->where(function ($query) use ($logRetentionDays): void {
                    $cutoff = now()->subDays($logRetentionDays);
                    $query->where('sent_at', '<', $cutoff)
                        ->orWhere(function ($query) use ($cutoff): void {
                            $query->whereNull('sent_at')
                                ->where('created_at', '<', $cutoff);
                        });
                })
                ->delete()
            : 0;

        $deletedOverflow = 0;
        if ($maxPerUser > 0) {
            DatabaseNotification::query()
                ->selectRaw('notifiable_type, notifiable_id, COUNT(*) AS aggregate')
                ->groupBy('notifiable_type', 'notifiable_id')
                ->havingRaw('COUNT(*) > ?', [$maxPerUser])
                ->orderBy('notifiable_type')
                ->orderBy('notifiable_id')
                ->get()
                ->each(function (DatabaseNotification $row) use ($maxPerUser, &$deletedOverflow): void {
                    $deletedOverflow += $this->pruneNotifiableOverflow(
                        (string) $row->notifiable_type,
                        (int) $row->notifiable_id,
                        $maxPerUser,
                    );
                });
        }

        return [
            'deleted_read' => $deletedRead,
            'deleted_unread' => $deletedUnread,
            'deleted_logs' => $deletedLogs,
            'deleted_overflow' => $deletedOverflow,
        ];
    }

    private function pruneNotifiableOverflow(string $notifiableType, int $notifiableId, int $maxPerUser): int
    {
        if ($maxPerUser <= 0) {
            return 0;
        }

        $overflowIds = DatabaseNotification::query()
            ->where('notifiable_type', $notifiableType)
            ->where('notifiable_id', $notifiableId)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->skip($maxPerUser)
            ->pluck('id');

        if ($overflowIds->isEmpty()) {
            return 0;
        }

        return DatabaseNotification::query()
            ->whereIn('id', $overflowIds->all())
            ->delete();
    }
}
