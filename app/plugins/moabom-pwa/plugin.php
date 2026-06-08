<?php

namespace Plugins\Moabom\Pwa;

use App\Extension\AbstractPlugin;

/**
 * Moabom PWA 플러그인
 *
 * `moabom-basic` 사용자 템플릿용 PWA Web Manifest · 루트 스코프 Service Worker
 * (`/pwa/sw.js`) · 결정적 버전 ETag 를 공개 API 로 제공한다. 모든 엔드포인트는
 * 비공개 사용자 정보를 다루지 않으므로 권한 체계는 정의하지 않는다.
 */
class Plugin extends AbstractPlugin
{
    /**
     * 플러그인 메타데이터 반환
     */
    public function getMetadata(): array
    {
        return [
            'author' => 'Moabom',
            'license' => 'MIT',
            'keywords' => ['pwa', 'service-worker', 'manifest', 'offline'],
        ];
    }
}
