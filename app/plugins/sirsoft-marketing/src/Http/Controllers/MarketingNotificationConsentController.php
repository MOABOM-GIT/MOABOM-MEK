<?php

declare(strict_types=1);

namespace Plugins\Sirsoft\Marketing\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Plugins\Sirsoft\Marketing\Http\Requests\UpdateNotificationConsentRequest;
use Plugins\Sirsoft\Marketing\Services\MarketingConsentService;

final class MarketingNotificationConsentController extends AuthBaseController
{
    private const CONSENT_KEY = 'notification_subscription';

    public function __construct(
        private readonly MarketingConsentService $consents,
    ) {
        parent::__construct();
    }

    public function show(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::error('auth.unauthenticated', 401);
        }

        return ResponseHelper::success(
            'sirsoft-marketing::messages.notification_consent_loaded',
            $this->payload((int) $user->id),
        );
    }

    public function update(UpdateNotificationConsentRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::error('auth.unauthenticated', 401);
        }

        $this->consents->updateConsent(
            (int) $user->id,
            self::CONSENT_KEY,
            (bool) $request->validated('enabled'),
            'profile',
        );

        return ResponseHelper::success(
            'sirsoft-marketing::messages.notification_consent_saved',
            $this->payload((int) $user->id),
        );
    }

    /**
     * @return array{enabled: bool, consented_at: string|null}
     */
    private function payload(int $userId): array
    {
        $record = $this->consents
            ->getAllByUserId($userId)
            ->firstWhere('consent_key', self::CONSENT_KEY);

        return [
            'enabled' => (bool) ($record?->is_consented ?? false),
            'consented_at' => $record?->consented_at?->toIso8601String(),
        ];
    }
}
