<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

use Modules\Moabom\System\Contracts\NotificationMaintenanceRepositoryInterface;

final class NotificationMaintenanceService
{
    public function __construct(
        private readonly NotificationMaintenanceRepositoryInterface $repository,
    ) {}

    public function pruneUserOverflow(int $userId): int
    {
        return $this->repository->pruneUserOverflow(
            $userId,
            max(0, (int) config('notification.database_channel.max_per_user', 500)),
        );
    }

    /**
     * @return array{deleted_read: int, deleted_unread: int, deleted_logs: int, deleted_overflow: int}
     */
    public function cleanup(): array
    {
        return $this->repository->cleanup(
            max(0, (int) config('notification.database_channel.read_retention_days', 30)),
            max(0, (int) config('notification.database_channel.unread_retention_days', 90)),
            max(0, (int) config('moabom-system.notification_policy.log_retention_days', 90)),
            max(0, (int) config('notification.database_channel.max_per_user', 500)),
        );
    }
}
