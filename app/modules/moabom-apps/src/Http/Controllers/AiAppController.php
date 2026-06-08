<?php

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Apps\Http\Requests\GenerateAiAppRequest;
use Modules\Moabom\Apps\Http\Requests\StoreGeneratedAppRequest;
use Modules\Moabom\Apps\Services\AiAppService;

class AiAppController extends AuthBaseController
{
    public function __construct(
        private readonly AiAppService $aiAppService,
    ) {
        parent::__construct();
    }

    /**
     * AI 앱 HTML을 생성합니다.
     */
    public function generate(GenerateAiAppRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $result = $this->aiAppService->generate($request->validated());

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.ai.generate_success',
            $result
        );
    }

    /**
     * 생성 앱 목록을 조회합니다.
     */
    public function index(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.fetch_success',
            [
                'items' => $this->aiAppService->listForUser($user->id),
            ]
        );
    }

    /**
     * 생성 앱 단건을 조회합니다 (HTML 포함).
     */
    public function show(int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->findForUser($user->id, $id);
        if (! $app) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.show_success',
            $this->aiAppService->serialize($app)
        );
    }

    /**
     * 생성 앱을 저장합니다.
     */
    public function store(StoreGeneratedAppRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->store($user->id, $request->validated());

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.save_success',
            $this->aiAppService->serialize($app),
            201
        );
    }

    /**
     * 생성 앱을 수정합니다.
     */
    public function update(StoreGeneratedAppRequest $request, int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->updateForUser($user->id, $id, $request->validated());
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.update_success',
            $this->aiAppService->serialize($app)
        );
    }
}
