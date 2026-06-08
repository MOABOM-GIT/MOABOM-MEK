<?php

namespace Modules\Moabom\Credit\Contracts;

use App\Contracts\Extension\ModuleSettingsInterface;

interface CreditSettingsServiceInterface extends ModuleSettingsInterface
{
    /**
     * 설정을 저장합니다.
     *
     * @param  array<string, mixed>  $settings
     */
    public function saveSettings(array $settings): bool;

    /**
     * 설정 캐시를 초기화합니다.
     */
    public function clearCache(): void;
}
