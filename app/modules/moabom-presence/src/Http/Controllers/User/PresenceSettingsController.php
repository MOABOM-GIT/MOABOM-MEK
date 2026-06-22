<?php

namespace Modules\Moabom\Presence\Http\Controllers\User;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Presence\Http\Requests\User\UpdatePresenceSettingsRequest;
use Modules\Moabom\Presence\Services\PresencePresentationService;
use Modules\Moabom\Presence\Services\PresenceUserPreferencesService;

final class PresenceSettingsController extends AuthBaseController
{
    public function __construct(
        private PresenceUserPreferencesService $settingsService,
        private PresencePresentationService $presentation,
    ) {
        parent::__construct();
    }

    public function show(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-presence.user.presence.settings.show');

        $preferences = $this->settingsService->getForUser($user->id);

        return ResponseHelper::moduleSuccess(
            'moabom-presence',
            'messages.presence_settings_success',
            $this->presentation->serializeSettings($preferences),
        );
    }

    public function update(UpdatePresenceSettingsRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-presence.user.presence.settings.update');

        $preferences = $this->settingsService->updateForUser($user, $request->validated());

        return ResponseHelper::moduleSuccess(
            'moabom-presence',
            'messages.presence_settings_updated',
            $this->presentation->serializeSettings($preferences),
        );
    }
}
