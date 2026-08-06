<?php

declare(strict_types=1);

namespace Plugins\Sirsoft\Marketing\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;
use App\Services\PluginSettingsService;
use Plugins\Sirsoft\Marketing\Services\MarketingConsentService;

/**
 * 기존 설치본의 채널 설정에 마케팅 시스템 알림 동의 항목을 추가합니다.
 */
final class Upgrade_1_0_1 implements UpgradeStepInterface
{
    private const PLUGIN_ID = 'sirsoft-marketing';

    public function run(UpgradeContext $context): void
    {
        try {
            $settings = app(PluginSettingsService::class);
            $raw = $settings->get(self::PLUGIN_ID, 'channels', '[]');
            $channels = json_decode((string) $raw, true);
            $channels = is_array($channels) ? array_values($channels) : [];

            foreach ($channels as $channel) {
                if (is_array($channel) && ($channel['key'] ?? null) === 'notification_subscription') {
                    return;
                }
            }

            $default = collect(app(MarketingConsentService::class)->getDefaultSystemChannels())
                ->firstWhere('key', 'notification_subscription');
            if (! is_array($default)) {
                return;
            }

            array_unshift($channels, $default);
            $settings->save(self::PLUGIN_ID, [
                'channels' => json_encode($channels, JSON_UNESCAPED_UNICODE),
            ]);
            $context->logger->info('[sirsoft-marketing 1.0.1] 마케팅 알림 동의 채널 추가 완료');
        } catch (\Throwable $e) {
            $context->logger->warning('[sirsoft-marketing 1.0.1] 알림 동의 채널 추가 실패: '.$e->getMessage());
        }
    }
}
