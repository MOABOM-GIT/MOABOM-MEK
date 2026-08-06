<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use App\Extension\HookManager;
use App\Helpers\ResponseHelper;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Arr;
use Modules\Moabom\System\Experience\TenantExperienceDefaultsReader;
use Modules\Moabom\System\Models\UserSystemSetting;
use Modules\Moabom\System\Support\MoabomUiLocales;

/**
 * 인증 셸 초기 상태 — 공개 shell-boot와 분리된 no-store 응답.
 */
final class UserShellStateController extends Controller
{
    public function __invoke(
        Request $request,
        TenantExperienceDefaultsReader $defaultsReader,
        NotificationService $notificationService,
    ): JsonResponse {
        $user = $request->user();
        if ($user === null) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $stored = UserSystemSetting::query()
            ->where('user_id', $user->id)
            ->first();
        $settingsPayload = [
            'defaults' => $defaultsReader->frontendDefaults(),
            'settings' => Arr::wrap($stored?->settings),
            'defaults_revision' => $defaultsReader->combinedRevision(),
            'site' => $defaultsReader->siteMeta(),
            'locale_catalog' => MoabomUiLocales::catalog(),
        ];
        $settingsScope = $request->query('scope') === 'critical' ? 'critical' : 'full';
        $settingsPayload = HookManager::applyFilters(
            'moabom.user_settings.response_data',
            $settingsPayload,
            $user,
            $settingsScope,
        );
        if (! is_array($settingsPayload)) {
            $settingsPayload = [];
        }

        $state = ['settings' => $settingsPayload];
        if ($request->query('scope') !== 'critical') {
            $state['unread_count'] = $notificationService->getUnreadCount($user);
            $state = HookManager::applyFilters('moabom.user_shell_state', $state, $user);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.user.fetch_success',
            is_array($state) ? $state : [],
        )->setPrivate()->setMaxAge(0);
    }
}
