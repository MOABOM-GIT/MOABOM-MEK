<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use App\Extension\HookManager;
use App\Helpers\ResponseHelper;
use App\Http\Resources\UserNotificationCollection;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;

/**
 * WS 장애·재연결 전용 통합 catch-up.
 *
 * 정상 부트에서는 호출하지 않으며, 한 번의 테넌트 부트로 알림·채팅·Presence
 * revision 상태를 함께 복구합니다.
 */
final class UserRealtimeStateController extends Controller
{
    public function __invoke(
        Request $request,
        NotificationService $notifications,
    ): JsonResponse {
        $user = $request->user();
        if ($user === null) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $allowedDomains = ['notifications', 'chat', 'presence'];
        $requestedDomains = array_values(array_intersect(
            $allowedDomains,
            array_filter(array_map(
                static fn (string $domain): string => trim($domain),
                explode(',', (string) $request->query('domains', implode(',', $allowedDomains))),
            )),
        ));
        $domains = $requestedDomains !== [] ? $requestedDomains : $allowedDomains;
        $occurredAt = now();

        $state = [
            'event_id' => (string) Str::uuid(),
            'domain' => 'realtime',
            'revision' => (int) $occurredAt->format('Uv'),
            'occurred_at' => $occurredAt->toIso8601String(),
        ];

        if (in_array('notifications', $domains, true)) {
            $notificationPage = $notifications->getNotifications($user, [], 20);
            $notificationPayload = (new UserNotificationCollection($notificationPage))->toArray($request);
            $state['notifications'] = [
                'unread_count' => $notifications->getUnreadCount($user),
                'items' => $notificationPayload['data'] ?? [],
                'pagination' => $notificationPayload['pagination'] ?? [],
            ];
        }

        $state = HookManager::applyFilters('moabom.user_realtime_state', $state, $user, $domains);

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.user.fetch_success',
            is_array($state) ? $state : [],
        )->setPrivate()->setMaxAge(0);
    }
}
