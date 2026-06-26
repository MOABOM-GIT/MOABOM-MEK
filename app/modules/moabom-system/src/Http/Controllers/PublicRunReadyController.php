<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

/**
 * Cloud Run startup probe · 콜드스타트 준비 확인 (DB 소켓 + Laravel 부트).
 */
final class PublicRunReadyController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $payload = ['ready' => true];
        $status = 200;

        try {
            DB::connection()->select('select 1 as ok');
            $payload['db'] = true;
        } catch (\Throwable) {
            // 콜드스타트: Laravel 라우트 응답 가능이면 200 (startup probe·scheduler). DB 는 별도 확인.
            $payload['db'] = false;
        }

        return response()->json($payload, $status);
    }
}
