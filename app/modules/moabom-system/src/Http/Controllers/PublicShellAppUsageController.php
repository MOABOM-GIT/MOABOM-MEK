<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use App\Helpers\ResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Modules\Moabom\System\Http\Requests\Public\GetShellRankingsRequest;
use Modules\Moabom\System\Http\Requests\Public\StoreShellAppUsageRequest;
use Modules\Moabom\System\Services\Shell\ShellAppUsageIngestService;
use Modules\Moabom\System\Services\Shell\ShellRankingService;
use Modules\Moabom\System\Services\Shell\ShellUsageIngestGuard;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

final class PublicShellAppUsageController extends Controller
{
    public function store(
        StoreShellAppUsageRequest $request,
        ShellAppUsageIngestService $ingestService,
        ShellUsageIngestGuard $ingestGuard,
    ): JsonResponse {
        $ingestGuard->enforce($request);

        $userId = Auth::guard('sanctum')->id();
        $accepted = $ingestService->ingest(
            $request->validated('events'),
            is_numeric($userId) ? (int) $userId : null,
        );

        if ($accepted > 0) {
            MoabomPublicApiCacheKeys::forgetShellRankings();
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.shell_rankings.usage_accepted',
            ['accepted' => $accepted],
        );
    }

    public function appRankings(
        GetShellRankingsRequest $request,
        ShellRankingService $rankingService,
    ): JsonResponse {
        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.shell_rankings.apps_fetch_success',
            $rankingService->appRankings($request->resolvedLimit()),
        );
    }

    public function userRankings(
        GetShellRankingsRequest $request,
        ShellRankingService $rankingService,
    ): JsonResponse {
        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.shell_rankings.users_fetch_success',
            $rankingService->userRankings($request->resolvedLimit()),
        );
    }
}
