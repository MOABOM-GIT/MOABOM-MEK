<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\System\Saas\Queue\CloudTasksQueueWakeDispatcher;
use Modules\Moabom\System\Saas\TenantRegistry;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;

/**
 * Cloud Tasks enqueue 실패·bulk insert로 남은 DB job을 깨우는 저빈도 안전망.
 */
final class MoabomQueueWakePendingCommand extends Command
{
    protected $signature = 'moabom:queue:wake-pending';

    protected $description = 'Dispatch Cloud Tasks wake-ups for pending platform and tenant database jobs';

    public function handle(
        TenantRegistry $tenantRegistry,
        TenantRuntimeBootstrap $runtimeBootstrap,
        CloudTasksQueueWakeDispatcher $dispatcher,
    ): int {
        if (config('moabom-system.queue_plane.mode', 'legacy') === 'legacy') {
            $this->components->info('Queue plane is legacy; nothing to wake.');

            return self::SUCCESS;
        }

        $woken = 0;
        try {
            $runtimeBootstrap->restorePlatformContext();
            $woken += $this->wakeCurrentDatabase(null, $dispatcher);

            foreach ($tenantRegistry->listActive() as $tenant) {
                if (! $runtimeBootstrap->bootstrapTenantBySlug($tenant->slug)) {
                    continue;
                }
                $woken += $this->wakeCurrentDatabase($tenant->slug, $dispatcher);
            }
        } finally {
            $runtimeBootstrap->restorePlatformContext();
        }

        $this->components->info("Queued {$woken} wake-up task(s).");

        return self::SUCCESS;
    }

    private function wakeCurrentDatabase(
        ?string $tenantSlug,
        CloudTasksQueueWakeDispatcher $dispatcher,
    ): int {
        $table = (string) config('queue.connections.database.table', 'jobs');
        $rows = DB::table($table)
            ->where(static function ($query): void {
                $retryAfter = (int) config('queue.connections.database.retry_after', 120);
                $query->whereNull('reserved_at')
                    ->orWhere('reserved_at', '<=', now()->subSeconds($retryAfter)->getTimestamp());
            })
            ->orderBy('available_at')
            ->orderBy('id')
            ->get(['id', 'queue', 'available_at'])
            ->unique('queue');
        $woken = 0;
        foreach ($rows as $row) {
            $delay = max(0, (int) $row->available_at - now()->getTimestamp());
            if ($dispatcher->enqueue($tenantSlug, (string) $row->queue, (string) $row->id, $delay)) {
                $woken++;
            }
        }

        return $woken;
    }
}
