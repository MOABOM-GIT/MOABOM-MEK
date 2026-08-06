<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Channels;

use App\Models\User;
use App\Notifications\BaseNotification;
use App\Notifications\GenericNotification;
use App\Services\NotificationTemplateService;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;
use Plugins\Moabom\Fcm\Exceptions\FcmSkippedException;
use Plugins\Moabom\Fcm\Services\FcmPushService;
use Plugins\Moabom\Fcm\Services\FcmUserPreferenceGate;
use Throwable;

/**
 * Laravel Notification 채널 — GenericNotification fcm 템플릿 → FCM HTTP v1.
 *
 * 의도적 생략(사용자 OFF·미설정·템플릿 없음)은 {@see FcmSkippedException} 으로
 * after_channel_send(sent) 오기록을 피한다. notification_logs 에는 failed + 사유.
 */
final class FcmChannel
{
    public function __construct(
        private readonly FcmPushService $push,
        private readonly FcmUserPreferenceGate $preferenceGate,
        private readonly NotificationTemplateService $templates,
    ) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (! $notifiable instanceof User) {
            throw new FcmSkippedException('fcm_notifiable_not_user');
        }

        if (! $this->push->isEnabled()) {
            throw new FcmSkippedException(__('moabom-fcm::messages.readiness_not_configured'));
        }

        if (! $this->preferenceGate->allows($notifiable)) {
            throw new FcmSkippedException(__('moabom-fcm::messages.skipped_user_disabled'));
        }

        [$title, $body, $data] = $this->resolvePayload($notifiable, $notification);
        if ($title === null && $body === null && $data === []) {
            throw new FcmSkippedException('notification.channel_skipped_no_template');
        }

        $result = $this->push->sendToUser($notifiable, $title, $body, $data);
        if (! $result->success) {
            throw new \RuntimeException($result->error ?? 'fcm_send_failed');
        }
    }

    /**
     * @return array{0: ?string, 1: ?string, 2: array<string, string>}
     */
    private function resolvePayload(User $notifiable, Notification $notification): array
    {
        if ($notification instanceof GenericNotification) {
            $template = $this->templates->resolve($notification->getType(), 'fcm');
            $locale = BaseNotification::resolveNotifiableLocale($notifiable);
            $rawData = $notification->getData();

            if ($template && $template->is_active) {
                $rendered = $template->replaceVariables($rawData, $locale);
                $clickUrl = $template->click_url
                    ? $template->replaceVariablesInString($template->click_url, $rawData)
                    : null;

                $data = [];
                foreach ($rawData as $key => $value) {
                    if (is_scalar($value) || $value === null) {
                        $data[(string) $key] = (string) ($value ?? '');
                    }
                }
                $data['notification_type'] = $notification->getType();
                $notificationId = isset($notification->id) && is_string($notification->id)
                    ? $notification->id
                    : (string) Str::uuid();
                $data['notification_id'] = $notificationId;
                $data['event_id'] = $notificationId;
                $data['unread_count'] = (string) $notifiable->unreadNotifications()->count();
                if (is_string($clickUrl) && $clickUrl !== '') {
                    $data['click_url'] = $clickUrl;
                }
                $data['tag'] = $this->groupTag(
                    $notification->getType(),
                    $rawData,
                    $clickUrl,
                );

                return [
                    $rendered['subject'] !== '' ? $rendered['subject'] : null,
                    $rendered['body'] !== '' ? $rendered['body'] : null,
                    $data,
                ];
            }
        }

        if (method_exists($notification, 'toFcm')) {
            try {
                /** @var mixed $payload */
                $payload = $notification->toFcm($notifiable);
                if (is_array($payload)) {
                    $title = isset($payload['title']) ? (string) $payload['title'] : null;
                    $body = isset($payload['body']) ? (string) $payload['body'] : null;
                    $data = [];
                    foreach (($payload['data'] ?? []) as $key => $value) {
                        if (is_scalar($value) || $value === null) {
                            $data[(string) $key] = (string) ($value ?? '');
                        }
                    }
                    if (! empty($payload['click_url']) && is_string($payload['click_url'])) {
                        $data['click_url'] = $payload['click_url'];
                    }

                    return [$title, $body, $data];
                }
            } catch (Throwable) {
                // fall through
            }
        }

        return [null, null, []];
    }

    /**
     * 같은 종류·대상의 반복 알림이 운영체제 알림 영역에서 한 묶음으로 갱신되게 합니다.
     *
     * @param  array<string, mixed>  $rawData
     */
    private function groupTag(string $type, array $rawData, ?string $clickUrl): string
    {
        $target = '';
        foreach (['conversation_id', 'post_id', 'comment_id', 'order_id', 'app_id', 'user_id'] as $key) {
            if (isset($rawData[$key]) && is_scalar($rawData[$key])) {
                $target = $key.':'.(string) $rawData[$key];
                break;
            }
        }

        $seed = implode('|', [$type, $target, (string) ($clickUrl ?? '')]);

        return 'moabom-'.substr(hash('sha256', $seed), 0, 32);
    }
}
