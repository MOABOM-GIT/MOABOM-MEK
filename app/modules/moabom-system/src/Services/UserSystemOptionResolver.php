<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

use App\Models\User;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Models\UserSystemSetting;

/**
 * 관리자 기본값과 사용자 오버라이드를 합성해 실제 시스템 옵션을 반환합니다.
 */
final class UserSystemOptionResolver
{
    public function resolve(User $user, string $optionId, bool $fallback = true): bool
    {
        [$onByDefault, $userEditable] = $this->adminOption($optionId, $fallback);
        if (! $userEditable) {
            return $onByDefault;
        }

        try {
            $settings = UserSystemSetting::query()
                ->where('user_id', (int) $user->id)
                ->first(['settings'])
                ?->settings;
            $value = is_array($settings)
                ? data_get($settings, "preferences.systemOptions.{$optionId}")
                : null;

            return is_bool($value) ? $value : $onByDefault;
        } catch (\Throwable) {
            return $onByDefault;
        }
    }

    /**
     * @return array{0: bool, 1: bool}
     */
    private function adminOption(string $optionId, bool $fallback): array
    {
        try {
            $options = app(SystemSettingsServiceInterface::class)
                ->getAllSettings()['preferences']['system_options'] ?? [];

            foreach ($options as $option) {
                if (! is_array($option) || ($option['id'] ?? null) !== $optionId) {
                    continue;
                }

                return [
                    (bool) ($option['on_by_default'] ?? $option['default'] ?? $fallback),
                    (bool) ($option['user_editable'] ?? true),
                ];
            }
        } catch (\Throwable) {
            // 설정 저장소가 준비되지 않은 부트·마이그레이션 구간은 안전 기본값을 사용합니다.
        }

        return [$fallback, true];
    }
}
