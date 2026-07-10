<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\GeneratedAppVersionService;

/**
 * 소유자용 생성앱 리비전(타임머신) API — AiAppController 와 분리.
 */
class GeneratedAppVersionController extends AuthBaseController
{
    public function __construct(
        private readonly AiAppService $aiAppService,
        private readonly GeneratedAppVersionService $versionService,
    ) {
        parent::__construct();
    }

    public function index(Request $request, int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->findForUser($user->id, $id);
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        $limit = max(1, min(100, (int) $request->query('limit', 30)));

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.revisions_fetch_success',
            [
                'revisions' => $this->versionService->listForApp($app, $limit),
                'current_version' => (int) ($app->version ?? 1),
            ]
        );
    }

    public function show(int $id, int $revisionId): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->findForUser($user->id, $id);
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        $revision = $this->versionService->findForApp($app, $revisionId);
        if ($revision === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.revision_not_found',
                404
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.revision_show_success',
            $this->versionService->serializeDetail($revision)
        );
    }

    public function restore(int $id, int $revisionId): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->findForUser($user->id, $id);
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        if ($this->versionService->findForApp($app, $revisionId) === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.revision_not_found',
                404
            );
        }

        $result = $this->versionService->restore($app, $revisionId, $user->id);

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.revision_restore_success',
            $this->aiAppService->serialize($result['app'], viewerUserId: $user->id)
        );
    }
}
