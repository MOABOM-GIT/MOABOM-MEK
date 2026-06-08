<?php

namespace Plugins\Moabom\Weather;

use App\Extension\AbstractPlugin;

/**
 * Moabom Weather 플러그인 진입점.
 *
 * Open-Meteo Forecast/Air-Quality 응답을 정규화한 Weather_Snapshot 과
 * Cloudflare 우선순위 IP geolocation 결과를 공개 API 로 제공한다.
 * 모든 엔드포인트는 비공개 사용자 정보를 다루지 않으므로 권한 체계는 정의하지 않는다.
 */
class Plugin extends AbstractPlugin
{
    public function getMetadata(): array
    {
        return [
            'author' => 'Moabom',
            'license' => 'MIT',
            'keywords' => ['weather', 'open-meteo', 'geolocation', 'cloudflare'],
        ];
    }
}
