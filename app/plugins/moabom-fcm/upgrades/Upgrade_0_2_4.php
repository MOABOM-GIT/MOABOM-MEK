<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;
use App\Services\SettingsService;

/**
 * 관리자 알림 채널 기본값에 FCM 활성 행을 저장합니다.
 */
final class Upgrade_0_2_4 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
        try {
            $settings = app(SettingsService::class);
            $channels = $settings->getSetting('notifications.channels', []);
            $channels = is_array($channels) ? array_values($channels) : [];

            foreach ($channels as $channel) {
                if (is_array($channel) && ($channel['id'] ?? null) === 'fcm') {
                    return;
                }
            }

            $channels[] = [
                'id' => 'fcm',
                'is_active' => true,
                'sort_order' => count($channels) + 1,
            ];
            $settings->setSetting('notifications.channels', $channels);
            $context->logger->info('[moabom-fcm 0.2.4] FCM 알림 채널 기본 ON 저장 완료');
        } catch (\Throwable $e) {
            $context->logger->warning('[moabom-fcm 0.2.4] FCM 알림 채널 기본값 저장 실패: '.$e->getMessage());
        }
    }
}
