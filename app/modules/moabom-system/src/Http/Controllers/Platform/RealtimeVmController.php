<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers\Platform;

use App\Helpers\ResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Moabom\System\Services\Realtime\RealtimeVmHealthService;

/**
 * mek360.com 플랫폼 전용 — Realtime VM(Reverb) 상태 대시보드 API.
 */
final class RealtimeVmController extends Controller
{
    public function __construct(
        private readonly RealtimeVmHealthService $health,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $force = filter_var($request->query('refresh', false), FILTER_VALIDATE_BOOL);
        $payload = $this->health->snapshot($force);

        return ResponseHelper::moduleSuccess('moabom-system', 'messages.realtime_vm_status_success', $payload);
    }

    public function refresh(): JsonResponse
    {
        $payload = $this->health->snapshot(true);

        return ResponseHelper::moduleSuccess('moabom-system', 'messages.realtime_vm_refresh_success', $payload);
    }
}
