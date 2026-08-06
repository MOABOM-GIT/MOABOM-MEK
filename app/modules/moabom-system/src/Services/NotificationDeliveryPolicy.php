<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

use App\Contracts\Extension\CacheInterface;
use App\Extension\HookManager;
use App\Models\User;
use App\Notifications\GenericNotification;

/**
 * 사용자 채널 선택과 알림 폭주 방지 정책을 발송 직전에 평가합니다.
 */
final class NotificationDeliveryPolicy
{
    public function __construct(
        private readonly CacheInterface $cache,
        private readonly UserSystemOptionResolver $systemOptions,
    ) {}

    /**
     * @return array{allowed: bool, reason: string|null, context: array<string, mixed>}
     */
    public function evaluate(object $notifiable, object $notification, string $channel): array
    {
        $context = $this->context($notifiable, $notification, $channel);
        $decision = ['allowed' => true, 'reason' => null];

        if (
            $channel === 'database'
            && $notifiable instanceof User
            && ! $context['mandatory']
            && ! $this->systemOptions->resolve($notifiable, 'notification_center', true)
        ) {
            $decision = [
                'allowed' => false,
                'reason' => 'notification_center_disabled_by_user',
            ];
        }

        if ($decision['allowed']) {
            $filtered = HookManager::applyFilters(
                'moabom.notification.delivery_decision',
                $decision,
                $context,
            );
            if (is_array($filtered)) {
                $decision['allowed'] = (bool) ($filtered['allowed'] ?? true);
                $decision['reason'] = isset($filtered['reason'])
                    ? (string) $filtered['reason']
                    : null;
            }
        }

        if ($decision['allowed'] && ! $context['mandatory']) {
            $decision = $this->applyFloodProtection($decision, $context);
        }

        return [
            'allowed' => $decision['allowed'],
            'reason' => $decision['reason'],
            'context' => $context,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function context(object $notifiable, object $notification, string $channel): array
    {
        $type = $notification instanceof GenericNotification
            ? $notification->getType()
            : $notification::class;
        $data = $notification instanceof GenericNotification
            ? $notification->getData()
            : [];
        $mandatoryTypes = (array) config('moabom-system.notification_policy.mandatory_types', []);
        $mandatory = ($data['mandatory'] ?? false) === true
            || ($data['notification_category'] ?? null) === 'required_service'
            || in_array($type, $mandatoryTypes, true);

        return [
            'channel' => $channel,
            'notification_type' => $type,
            'extension_type' => $notification instanceof GenericNotification
                ? $notification->getExtensionType()
                : 'core',
            'extension_identifier' => $notification instanceof GenericNotification
                ? $notification->getExtensionIdentifier()
                : 'core',
            'notifiable' => $notifiable,
            'recipient_user_id' => $notifiable instanceof User ? (int) $notifiable->id : null,
            'recipient_identifier' => $notifiable->email
                ?? (method_exists($notifiable, 'getKey') ? (string) ($notifiable->getKey() ?? '') : $notifiable::class),
            'recipient_name' => $notifiable->name ?? null,
            'mandatory' => $mandatory,
            'data' => $data,
        ];
    }

    /**
     * @param  array{allowed: bool, reason: string|null}  $decision
     * @param  array<string, mixed>  $context
     * @return array{allowed: bool, reason: string|null}
     */
    private function applyFloodProtection(array $decision, array $context): array
    {
        $dedupeSeconds = max(
            0,
            (int) config('moabom-system.notification_policy.dedupe_window_seconds', 30),
        );
        $windowSeconds = max(
            1,
            (int) config('moabom-system.notification_policy.burst_window_seconds', 60),
        );
        $maxPerWindow = max(
            0,
            (int) config('moabom-system.notification_policy.max_per_recipient_type_channel', 100),
        );

        try {
            if ($dedupeSeconds > 0) {
                $dedupeKey = 'notification:dedupe:'.$this->fingerprint($context);
                if ($this->cache->has($dedupeKey)) {
                    return ['allowed' => false, 'reason' => 'duplicate_within_window'];
                }
            }

            if ($maxPerWindow > 0) {
                $bucket = intdiv(time(), $windowSeconds);
                $burstKey = sprintf(
                    'notification:burst:%s:%s',
                    $this->recipientTypeChannelKey($context),
                    $bucket,
                );
                $count = max(0, (int) $this->cache->get($burstKey, 0));
                if ($count >= $maxPerWindow) {
                    return ['allowed' => false, 'reason' => 'recipient_rate_limit_exceeded'];
                }
                $this->cache->put($burstKey, $count + 1, $windowSeconds + 5);
            }

            if ($dedupeSeconds > 0) {
                $this->cache->put($dedupeKey, true, $dedupeSeconds);
            }
        } catch (\Throwable) {
            // 캐시 장애가 필수 서비스 흐름까지 막지 않도록 fail-open 합니다.
        }

        return $decision;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function fingerprint(array $context): string
    {
        $payload = [
            'recipient' => $context['recipient_identifier'],
            'type' => $context['notification_type'],
            'channel' => $context['channel'],
            'data' => $this->normalize($context['data']),
        ];

        return hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function recipientTypeChannelKey(array $context): string
    {
        return hash('sha256', implode('|', [
            (string) $context['recipient_identifier'],
            (string) $context['notification_type'],
            (string) $context['channel'],
        ]));
    }

    private function normalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return is_object($value) ? $value::class : $value;
        }

        if (! array_is_list($value)) {
            ksort($value);
        }

        foreach ($value as $key => $item) {
            $value[$key] = $this->normalize($item);
        }

        return $value;
    }
}
