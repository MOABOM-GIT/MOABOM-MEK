<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Models\User;
use Plugins\Moabom\Fcm\Services\FcmPushService;
use Plugins\Moabom\Fcm\Services\FcmUserPreferenceGate;

final class FcmNotificationChannelListener implements HookListenerInterface
{
    public function __construct(
        private readonly FcmPushService $push,
        private readonly FcmUserPreferenceGate $preferenceGate,
    ) {}

    public static function getSubscribedHooks(): array
    {
        return [
            'core.notification.filter_available_channels' => [
                'method' => 'registerFcmChannel',
                'priority' => 20,
                'type' => 'filter',
            ],
            'core.notification.channel_readiness' => [
                'method' => 'checkReadiness',
                'priority' => 20,
                'type' => 'filter',
            ],
            'moabom.notification.delivery_decision' => [
                'method' => 'applyUserPreference',
                'priority' => 10,
                'type' => 'filter',
            ],
            'core.settings.filter_save_data' => [
                'method' => 'persistFcmChannelDefault',
                'priority' => 20,
                'type' => 'filter',
            ],
        ];
    }

    public function handle(...$args): void {}

    /**
     * @param  array<int, array<string, mixed>>  $channels
     * @return array<int, array<string, mixed>>
     */
    public function registerFcmChannel(array $channels): array
    {
        foreach ($channels as $channel) {
            if (($channel['id'] ?? null) === 'fcm') {
                return $channels;
            }
        }

        $channels[] = [
            'id' => 'fcm',
            'name_key' => 'moabom-fcm::notification.channels.fcm.name',
            'icon' => 'fas fa-mobile-alt',
            'description_key' => 'moabom-fcm::notification.channels.fcm.description',
            'source' => 'plugin',
            'source_label_key' => 'moabom-fcm::notification.channels.source_label',
            'allow_guest' => false,
        ];

        return $channels;
    }

    /**
     * @param  array{ready: bool, reason: string|null}  $result
     * @return array{ready: bool, reason: string|null}
     */
    public function checkReadiness(array $result, string $channelId = ''): array
    {
        if ($channelId !== 'fcm') {
            return $result;
        }

        if ($this->push->isEnabled()) {
            return ['ready' => true, 'reason' => null];
        }

        return [
            'ready' => false,
            'reason' => 'moabom-fcm::messages.readiness_not_configured',
        ];
    }

    /**
     * @param  array{allowed: bool, reason: string|null}  $decision
     * @param  array<string, mixed>  $context
     * @return array{allowed: bool, reason: string|null}
     */
    public function applyUserPreference(array $decision, array $context): array
    {
        if (($context['channel'] ?? null) !== 'fcm' || ! ($decision['allowed'] ?? true)) {
            return $decision;
        }

        $user = $context['notifiable'] ?? null;
        if ($user instanceof User && ! $this->preferenceGate->allows($user)) {
            return [
                'allowed' => false,
                'reason' => 'system_notification_disabled_by_user',
            ];
        }

        return $decision;
    }

    /**
     * 관리자 알림 설정 저장 시 FCM도 mail/database와 같은 기본 ON 행으로 보존합니다.
     *
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    public function persistFcmChannelDefault(array $settings): array
    {
        $nested = isset($settings['notifications']) && is_array($settings['notifications']);
        $isNotificationsTab = ($settings['_tab'] ?? null) === 'notifications';
        if (! $nested && ! $isNotificationsTab) {
            return $settings;
        }

        $notificationSettings = $nested ? $settings['notifications'] : $settings;
        $channels = $notificationSettings['channels'] ?? [];
        $channels = is_array($channels) ? array_values($channels) : [];
        foreach ($channels as $channel) {
            if (is_array($channel) && ($channel['id'] ?? null) === 'fcm') {
                return $settings;
            }
        }

        $channels[] = [
            'id' => 'fcm',
            'is_active' => true,
            'sort_order' => count($channels) + 1,
        ];
        $notificationSettings['channels'] = $channels;
        if ($nested) {
            $settings['notifications'] = $notificationSettings;
        } else {
            $settings = $notificationSettings;
        }

        return $settings;
    }
}
