<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Contracts;

interface NotificationMaintenanceRepositoryInterface
{
    public function pruneUserOverflow(int $userId, int $maxPerUser): int;

    /**
     * @return array{deleted_read: int, deleted_unread: int, deleted_logs: int, deleted_overflow: int}
     */
    public function cleanup(
        int $readRetentionDays,
        int $unreadRetentionDays,
        int $logRetentionDays,
        int $maxPerUser,
    ): array;
}
