<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Http\Controllers\User;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Plugins\Moabom\Fcm\Services\FcmPushService;

/**
 * 브라우저 FCM SDK 용 공개 설정 (시크릿 없음).
 */
final class FcmWebConfigController extends Controller
{
    public function __construct(
        private readonly FcmPushService $push,
    ) {}

    public function __invoke(): JsonResponse
    {
        $web = config('moabom-fcm.web', []);
        $configured = $this->push->isEnabled()
            && filled($web['api_key'] ?? null)
            && filled($web['messaging_sender_id'] ?? null)
            && filled($web['app_id'] ?? null)
            && filled($web['vapid_key'] ?? null);

        return ResponseHelper::success('messages.success', [
            'enabled' => $configured,
            'firebase' => $configured ? [
                'apiKey' => (string) $web['api_key'],
                'authDomain' => (string) ($web['auth_domain'] ?? ''),
                'projectId' => (string) ($web['project_id'] ?? config('moabom-fcm.project_id')),
                'messagingSenderId' => (string) $web['messaging_sender_id'],
                'appId' => (string) $web['app_id'],
            ] : null,
            'vapidKey' => $configured ? (string) $web['vapid_key'] : null,
        ]);
    }
}
