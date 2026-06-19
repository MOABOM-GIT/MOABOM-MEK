<?php

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Apps\Services\AiGenerationSessionService;

class AiGenerationSessionController extends AuthBaseController
{
    public function __construct(
        private readonly AiGenerationSessionService $sessionService,
    ) {
        parent::__construct();
    }

    public function active(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $session = $this->sessionService->findActiveForUser($user->id);
        if ($session === null) {
            return ResponseHelper::moduleSuccess(
                'moabom-apps',
                'messages.apps.ai.session_fetch_success',
                ['session' => null],
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.ai.session_resume_available',
            ['session' => $this->sessionService->serialize($session)],
        );
    }

    public function show(int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $session = $this->sessionService->findForUser($user->id, $id);
        if ($session === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.ai.session_not_found',
                404,
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.ai.session_fetch_success',
            ['session' => $this->sessionService->serialize($session)],
        );
    }

    public function cancelStreaming(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $this->sessionService->cancelStreamingForUser($user->id);

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.ai.session_cancel_success',
            ['cancelled' => true],
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        if (! $this->sessionService->cancelForUser($user->id, $id)) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.ai.session_not_found',
                404,
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.ai.session_cancel_success',
            ['id' => $id],
        );
    }
}
