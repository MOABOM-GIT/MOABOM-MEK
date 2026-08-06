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
        $autoloadReady = is_file(base_path('bootstrap/cache/autoload-extensions.php'))
            && filesize(base_path('bootstrap/cache/autoload-extensions.php')) > 0;
        $payload = [
            'ready' => false,
            'autoload' => $autoloadReady,
        ];
        $status = 503;

        try {
            DB::connection()->select('select 1 as ok');
            $payload['db'] = true;
        } catch (\Throwable) {
            $payload['db'] = false;
        }

        if ($autoloadReady && $payload['db'] === true) {
            $payload['ready'] = true;
            $status = 200;
        }

        return response()->json($payload, $status);
    }
}
