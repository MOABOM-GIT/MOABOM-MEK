<?php

namespace Modules\Moabom\Presence\Http\Controllers\Public;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\PublicBaseController;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Presence\Http\Requests\Public\PresenceHeartbeatRequest;
use Modules\Moabom\Presence\Services\PresenceHeartbeatService;
use Modules\Moabom\Presence\Services\PresenceRevisionService;
use Modules\Moabom\Presence\Services\PresenceSummaryService;
use Modules\Moabom\Presence\Services\PresenceUserPreferencesService;
use Modules\Moabom\Presence\Services\TenantOnlineUsersService;
use Modules\Moabom\Presence\Support\PresenceClientIpMasker;

final class PresencePublicController extends PublicBaseController
{
    public function __construct(
        private PresenceSummaryService $summaryService,
        private PresenceHeartbeatService $heartbeatService,
        private TenantOnlineUsersService $onlineUsersService,
        private PresenceUserPreferencesService $preferencesService,
        private PresenceRevisionService $revisionService,
        private PresenceClientIpMasker $clientIpMasker,
    ) {
        parent::__construct();
    }

    public function summary(): JsonResponse
    {
        $this->logApiUsage('moabom-presence.public.summary');

        return ResponseHelper::moduleSuccess(
            'moabom-presence',
            'messages.summary_success',
            $this->summaryService->getSummary(),
        );
    }

    public function online(): JsonResponse
    {
        $this->logApiUsage('moabom-presence.public.online');

        $viewer = auth('sanctum')->user();
        $viewerMaskedIp = $viewer instanceof User
            ? $this->clientIpMasker->maskFromRequest(request())
            : null;

        return ResponseHelper::moduleSuccess(
            'moabom-presence',
            'messages.online_success',
            [
                'revision' => $this->revisionService->current(),
                'users' => $this->onlineUsersService->listOnlineUsers($viewer, 50, $viewerMaskedIp),
            ],
        );
    }

    public function heartbeat(PresenceHeartbeatRequest $request): JsonResponse
    {
        $this->logApiUsage('moabom-presence.public.heartbeat');

        $result = $this->heartbeatService->record(
            $request,
            auth('sanctum')->user(),
            $request->validated('status_text'),
            $request->validated('client_form_factor'),
            $request->validated('touch'),
            $request->validated('ws_state'),
            $request->validated('visibility_state'),
        );

        return ResponseHelper::moduleSuccess(
            'moabom-presence',
            'messages.heartbeat_success',
            $result,
        );
    }

    public function userPresence(string $userUuid): JsonResponse
    {
        $this->logApiUsage('moabom-presence.public.user_presence');

        $user = User::query()->where('uuid', $userUuid)->first();
        if (! $user) {
            return ResponseHelper::moduleError(
                'moabom-presence',
                'messages.user_presence_not_found',
                404,
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-presence',
            'messages.user_presence_success',
            $this->preferencesService->getPublicPresenceForUser($user),
        );
    }
}
