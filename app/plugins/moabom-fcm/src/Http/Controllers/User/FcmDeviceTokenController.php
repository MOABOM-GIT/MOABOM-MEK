<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Http\Controllers\User;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Plugins\Moabom\Fcm\Http\Requests\RegisterFcmTokenRequest;
use Plugins\Moabom\Fcm\Services\FcmDeviceTokenService;

final class FcmDeviceTokenController extends AuthBaseController
{
    public function __construct(
        private readonly FcmDeviceTokenService $tokens,
    ) {
        parent::__construct();
    }

    public function store(RegisterFcmTokenRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if ($user === null) {
            return $this->unauthorized();
        }

        $row = $this->tokens->register($user, [
            'token' => (string) $request->validated('token'),
            'platform' => (string) $request->validated('platform', 'web'),
            'device_label' => $request->validated('device_label'),
            'user_agent' => $request->userAgent(),
        ]);

        return ResponseHelper::success('moabom-fcm::messages.token_registered', [
            'id' => $row->id,
            'platform' => $row->platform instanceof \BackedEnum
                ? $row->platform->value
                : (string) $row->platform,
            'last_seen_at' => $row->last_seen_at?->toIso8601String(),
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if ($user === null) {
            return $this->unauthorized();
        }

        $token = trim((string) $request->input('token', ''));
        if ($token === '') {
            return ResponseHelper::error('moabom-fcm::messages.token_required', 422);
        }

        $deleted = $this->tokens->deleteForUser($user, $token);

        return ResponseHelper::success('moabom-fcm::messages.token_deleted', [
            'deleted' => $deleted,
        ]);
    }
}
