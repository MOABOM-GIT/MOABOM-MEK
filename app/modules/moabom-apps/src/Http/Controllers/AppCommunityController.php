<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\PublicBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Http\Requests\StoreAppCommunityPostRequest;
use Modules\Moabom\Apps\Http\Requests\UpdateAppCommunityPostRequest;
use Modules\Moabom\Apps\Services\AppCommunityService;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * 앱 이야기 사용자 API.
 */
final class AppCommunityController extends PublicBaseController
{
    public function __construct(
        private readonly AppCommunityService $communityService,
    ) {
        parent::__construct();
    }

    public function summary(Request $request, int $id): JsonResponse
    {
        $viewerUserId = $this->getCurrentUser()?->id;

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.community.summary_success',
            $this->communityService->summary($id, $viewerUserId !== null ? (int) $viewerUserId : null),
        );
    }

    public function index(Request $request, int $id): JsonResponse
    {
        $viewerUserId = $this->getCurrentUser()?->id;
        $perPage = max(1, min(50, (int) $request->query('per_page', 20)));

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.community.list_success',
            $this->communityService->listPosts($id, $viewerUserId !== null ? (int) $viewerUserId : null, $perPage),
        );
    }

    public function show(Request $request, int $id, int $postId): JsonResponse
    {
        $viewerUserId = $this->getCurrentUser()?->id;

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.community.show_success',
            $this->communityService->showPost(
                $id,
                $postId,
                $viewerUserId !== null ? (int) $viewerUserId : null,
            ),
        );
    }

    public function store(StoreAppCommunityPostRequest $request, int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if ($user === null) {
            return $this->unauthorized('auth.unauthenticated');
        }

        try {
            $item = $this->communityService->createReview($id, (int) $user->id, $request->validatedReview());
        } catch (AccessDeniedHttpException) {
            return ResponseHelper::moduleError('moabom-apps', 'messages.apps.community.forbidden', 403);
        } catch (ConflictHttpException $exception) {
            return ResponseHelper::moduleError('moabom-apps', 'messages.apps.community.review_exists', 409);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.community.create_success',
            ['item' => $item],
            201,
        );
    }

    public function update(UpdateAppCommunityPostRequest $request, int $id, int $postId): JsonResponse
    {
        $user = $this->getCurrentUser();
        if ($user === null) {
            return $this->unauthorized('auth.unauthenticated');
        }

        try {
            $item = $this->communityService->updateReview(
                $id,
                $postId,
                (int) $user->id,
                $request->validatedReview(),
            );
        } catch (AccessDeniedHttpException) {
            return ResponseHelper::moduleError('moabom-apps', 'messages.apps.community.forbidden', 403);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.community.update_success',
            ['item' => $item],
        );
    }

    public function destroy(Request $request, int $id, int $postId): JsonResponse
    {
        $user = $this->getCurrentUser();
        if ($user === null) {
            return $this->unauthorized('auth.unauthenticated');
        }

        try {
            $this->communityService->deleteReview($id, $postId, (int) $user->id);
        } catch (AccessDeniedHttpException) {
            return ResponseHelper::moduleError('moabom-apps', 'messages.apps.community.forbidden', 403);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.community.delete_success',
            ['deleted_id' => $postId],
        );
    }
}
