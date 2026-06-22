<?php

namespace Plugins\Moabom\Reverb;

use App\Extension\AbstractPlugin;

/**
 * Moabom Reverb 플러그인 — WebSocket drivers 시드·런타임 적용.
 *
 * moabom-system 의 TenantSettingsSeeder·SaasCoreSettingsHydrator 는
 * `moabom.saas.drivers.*` 훅으로만 이 플러그인과 연결된다.
 */
class Plugin extends AbstractPlugin
{
    public function getMetadata(): array
    {
        return [
            'author' => 'Moabom',
            'license' => 'MIT',
            'keywords' => ['reverb', 'websocket', 'broadcasting', 'saas'],
        ];
    }
}
