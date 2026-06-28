<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\PublicBaseController;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\PublicUserFrequentShellAppsService;

/**
 * 공개 프로필 — 사용자별 등록·공개 생성 앱 목록.
 */
final class PublicUserGeneratedAppController extends PublicBaseController
{
    public function __construct(
        private readonly AiAppService $aiAppService,
    ) {
        parent::__construct();
    }

    public function index(Request $request, User $user): JsonResponse
    {
        $perPage = max(1, min(50, (int) $request->query('per_page', 20)));
        $viewerUserId = $this->getCurrentUser()?->id;

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.user_public_list_success',
            $this->aiAppService->paginatePublishedForUser(
                (int) $user->id,
                $perPage,
                $viewerUserId !== null ? (int) $viewerUserId : null,
            ),
        );
    }

    public function frequent(Request $request, User $user, PublicUserFrequentShellAppsService $frequentApps): JsonResponse
    {
        $limit = max(1, min(5, (int) $request->query('limit', 5)));
        $viewerUserId = $this->getCurrentUser()?->id;

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.user_frequent_apps_success',
            $frequentApps->listForUser(
                (int) $user->id,
                $limit,
                $viewerUserId !== null ? (int) $viewerUserId : null,
            ),
        );
    }
}
