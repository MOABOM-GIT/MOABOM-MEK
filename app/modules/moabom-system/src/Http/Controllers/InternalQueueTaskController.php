<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Queue\Worker;
use Illuminate\Queue\WorkerOptions;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\System\Saas\Queue\CloudTasksQueueWakeDispatcher;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;

final class InternalQueueTaskController extends Controller
{
    public function __invoke(
        Request $request,
        TenantRuntimeBootstrap $runtimeBootstrap,
        CloudTasksQueueWakeDispatcher $wakeDispatcher,
    ): JsonResponse {
        if (
            config('moabom-system.queue_plane.runtime_role', 'web') !== 'queue'
            || config('moabom-system.queue_plane.mode', 'legacy') !== 'active'
            || trim((string) $request->header('X-CloudTasks-TaskName', '')) === ''
        ) {
            abort(404);
        }

        $validated = $request->validate([
            'tenant_slug' => ['nullable', 'string', 'max:80'],
            'queue' => ['required', 'string', 'regex:/^[A-Za-z0-9._-]+$/', 'max:80'],
            'job_id' => ['required', 'string', 'max:80'],
        ]);
        $tenantSlug = isset($validated['tenant_slug']) && $validated['tenant_slug'] !== ''
            ? (string) $validated['tenant_slug']
            : null;
        if ($tenantSlug !== null) {
            if (! $runtimeBootstrap->bootstrapTenantBySlug($tenantSlug)) {
                return response()->json(['processed' => false, 'reason' => 'tenant_missing']);
            }
        } else {
            $runtimeBootstrap->restorePlatformContext();
        }

        $queue = (string) $validated['queue'];
        /** @var Worker $worker */
        $worker = app('queue.worker');
        // HTTP 요청 안에서 daemon()을 실행하면 worker resetScope가 현재 request/scoped
        // 바인딩까지 초기화해 응답 직전에 500이 발생할 수 있습니다. Cloud Task 하나는
        // DB job 하나만 처리하고 종료하는 runNextJob() 계약을 사용합니다.
        $worker->runNextJob('database', $queue, new WorkerOptions(
            name: 'cloud-tasks',
            backoff: 5,
            memory: 192,
            timeout: 60,
            sleep: 0,
            maxTries: 3,
            force: true,
        ));

        $next = DB::table((string) config('queue.connections.database.table', 'jobs'))
            ->where('queue', $queue)
            ->where(static function ($query): void {
                $retryAfter = (int) config('queue.connections.database.retry_after', 120);
                $query->whereNull('reserved_at')
                    ->orWhere('reserved_at', '<=', now()->subSeconds($retryAfter)->getTimestamp());
            })
            ->orderBy('available_at')
            ->orderBy('id')
            ->first(['id', 'available_at']);
        if ($next !== null) {
            $delay = max(0, (int) $next->available_at - now()->getTimestamp());
            $wakeDispatcher->enqueue($tenantSlug, $queue, (string) $next->id, $delay);
        }

        return response()->json([
            'processed' => true,
            'requested_job_id' => (string) $validated['job_id'],
        ]);
    }
}
