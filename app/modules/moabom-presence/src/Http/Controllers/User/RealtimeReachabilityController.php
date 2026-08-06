<?php

declare(strict_types=1);

namespace Modules\Moabom\Presence\Http\Controllers\User;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Presence\Http\Requests\User\AcknowledgeRealtimeChallengeRequest;
use Modules\Moabom\Presence\Services\RealtimeReachabilityChallengeService;

final class RealtimeReachabilityController extends AuthBaseController
{
    public function __construct(
        private readonly RealtimeReachabilityChallengeService $challenges,
    ) {
        parent::__construct();
    }

    public function challenge(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-presence.user.realtime.challenge');

        return ResponseHelper::moduleSuccess(
            'moabom-presence',
            'messages.realtime_challenge_sent',
            $this->challenges->issue($user),
        );
    }

    public function acknowledge(AcknowledgeRealtimeChallengeRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-presence.user.realtime.acknowledge');
        if (! $this->challenges->acknowledge($user, (string) $request->validated('token'))) {
            return ResponseHelper::moduleError(
                'moabom-presence',
                'messages.realtime_challenge_invalid',
                422,
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-presence',
            'messages.realtime_challenge_acknowledged',
            ['reachable' => true],
        );
    }
}
