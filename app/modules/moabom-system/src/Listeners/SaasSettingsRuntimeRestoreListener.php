<?php

namespace Modules\Moabom\System\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use Modules\Moabom\System\Branding\TenantExperiencePublicCacheInvalidator;
use Modules\Moabom\System\Saas\SaasCachedConfigBridge;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;

/**
 * G7 saveSettings() → config:clear 후 SaaS GCS prefix 복원 + G7 config 재동기화.
 */
final class SaasSettingsRuntimeRestoreListener implements HookListenerInterface
{
    public static function getSubscribedHooks(): array
    {
        return [
            'core.settings.after_save' => [
                'method' => 'onSettingsAfterSave',
                'priority' => 5,
            ],
        ];
    }

    public function handle(...$args): void
    {
        // HookListenerInterface 필수 — 실제 처리는 onSettingsAfterSave
    }

    /**
     * @param  mixed  ...$args  ($tab, $mergedSettings, $result)
     */
    public function onSettingsAfterSave(...$args): void
    {
        SaasCachedConfigBridge::applyIfNeeded();

        if (! config('moabom-system.saas.enabled', false)) {
            return;
        }

        $result = $args[2] ?? false;
        if ($result !== true) {
            return;
        }

        $tab = (string) ($args[0] ?? '');
        app(TenantExperiencePublicCacheInvalidator::class)->invalidateAfterCoreSettingsSave($tab);

        app(TenantRuntimeBootstrap::class)->rehydrateAfterSettingsSave(app(TenantContext::class));
    }
}
