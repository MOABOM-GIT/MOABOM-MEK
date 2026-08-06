<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Services;

use App\Models\User;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Models\UserSystemSetting;

/**
 * 사용자 푸시 옵션을 FCM 발송 시점에 적용합니다.
 *
 * 설정 행이나 신규 필드가 없는 기존 사용자는 기존 동작을 유지하도록 허용합니다.
 */
final class FcmUserPreferenceGate
{
    public function allows(User $user): bool
    {
        $userId = (int) $user->id;
        [$onByDefault, $userEditable] = $this->adminOption();
        if (! $userEditable) {
            return $onByDefault;
        }

        if (! class_exists(UserSystemSetting::class)) {
            return $onByDefault;
        }

        try {
            $settings = UserSystemSetting::query()
                ->where('user_id', $userId)
                ->first(['settings'])
                ?->settings;
            $push = is_array($settings)
                ? data_get($settings, 'preferences.systemOptions.push')
                : null;

            return is_bool($push) ? $push : $onByDefault;
        } catch (\Throwable) {
            return $onByDefault;
        }
    }

    /**
     * @return array{0: bool, 1: bool}
     */
    private function adminOption(): array
    {
        if (! interface_exists(SystemSettingsServiceInterface::class)
            || ! app()->bound(SystemSettingsServiceInterface::class)
        ) {
            return [true, true];
        }

        try {
            $options = app(SystemSettingsServiceInterface::class)
                ->getAllSettings()['preferences']['system_options'] ?? [];
            foreach ($options as $option) {
                if (! is_array($option) || ($option['id'] ?? null) !== 'push') {
                    continue;
                }

                return [
                    (bool) ($option['on_by_default'] ?? $option['default'] ?? true),
                    (bool) ($option['user_editable'] ?? true),
                ];
            }
        } catch (\Throwable) {
            // 신규 옵션이 없는 구 버전과 동일하게 허용합니다.
        }

        return [true, true];
    }
}
