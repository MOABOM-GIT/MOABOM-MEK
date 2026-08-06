<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Artisan;

final class InternalSchedulerTickController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        if (
            config('moabom-system.queue_plane.runtime_role', 'web') !== 'queue'
            || config('moabom-system.queue_plane.mode', 'legacy') !== 'active'
            || trim((string) $request->header('X-CloudScheduler-JobName', '')) === ''
        ) {
            abort(404);
        }

        $exitCode = Artisan::call('schedule:run', ['--no-interaction' => true]);
        $queueWakeExitCode = null;
        if (now()->minute % 5 === 0) {
            $queueWakeExitCode = Artisan::call('moabom:queue:wake-pending');
        }

        return response()->json([
            'ok' => $exitCode === 0 && ($queueWakeExitCode === null || $queueWakeExitCode === 0),
            'exit_code' => $exitCode,
            'queue_wake_exit_code' => $queueWakeExitCode,
        ], $exitCode === 0 && ($queueWakeExitCode === null || $queueWakeExitCode === 0) ? 200 : 500);
    }
}
