<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Modules\Moabom\System\Saas\Queue\RealtimeQueueProbeJob;

/**
 * DB queue → Cloud Tasks → queue service 전체 경로를 사용자 데이터 없이 검증합니다.
 */
final class MoabomQueueProbeCommand extends Command
{
    protected $signature = 'moabom:queue:probe {--timeout=45 : 처리 완료 대기 초}';

    protected $description = 'Verify the active Cloud Tasks queue plane end to end';

    public function handle(): int
    {
        if (config('moabom-system.queue_plane.mode', 'legacy') !== 'active') {
            $this->error('Queue plane is not active.');

            return self::FAILURE;
        }

        $timeout = max(5, min(120, (int) $this->option('timeout')));
        $queueName = 'realtime-probe';
        $token = (string) Str::uuid();
        $jobsTable = (string) config('queue.connections.database.table', 'jobs');
        Queue::connection('database')->push(
            (new RealtimeQueueProbeJob($token))->onQueue($queueName),
            '',
            $queueName,
        );
        $jobId = DB::table($jobsTable)
            ->where('queue', $queueName)
            ->where('payload', 'like', '%'.$token.'%')
            ->orderByDesc('id')
            ->value('id');
        if ($jobId === null) {
            $this->error('Probe job dispatch returned no job ID.');

            return self::FAILURE;
        }

        $deadline = microtime(true) + $timeout;

        while (microtime(true) < $deadline) {
            $pending = DB::table($jobsTable)->where('id', $jobId)->exists();
            if (! $pending) {
                if ($this->probeFailed($token)) {
                    $this->error('Probe job reached queue service but failed.');

                    return self::FAILURE;
                }

                $this->info('OK: DB queue → Cloud Tasks → queue service');

                return self::SUCCESS;
            }

            usleep(250_000);
        }

        DB::table($jobsTable)
            ->where('id', $jobId)
            ->where('queue', $queueName)
            ->delete();
        $this->error("Queue probe timed out after {$timeout}s.");

        return self::FAILURE;
    }

    private function probeFailed(string $token): bool
    {
        $failedTable = (string) config('queue.failed.table', 'failed_jobs');
        if (! Schema::hasTable($failedTable)) {
            return false;
        }

        return DB::table($failedTable)
            ->where('payload', 'like', '%'.$token.'%')
            ->exists();
    }
}
