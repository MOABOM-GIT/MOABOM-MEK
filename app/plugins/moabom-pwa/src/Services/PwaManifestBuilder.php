<?php

namespace Plugins\Moabom\Pwa\Services;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Lang;

/**
 * PWA `manifest.webmanifest` 본문을 조립하는 서비스.
 *
 * `Accept-Language` 헤더 하나만 입력받아 로케일을 결정하고, 해당 로케일로
 * `name`/`short_name`/`description` 번역을 읽어 배열을 반환한다. 매칭 실패
 * 시 `config('app.fallback_locale')` 로 폴백한다(Req 3.3).
 *
 * Spec: `.kiro/specs/moabom-pwa-service-worker/` Req 3 · Design §4.5
 */
final class PwaManifestBuilder
{
    /** 아이콘 엔드포인트 URL prefix — 템플릿 dist/pwa/icons 자산을 서빙하는 경로. */
    private const ICON_URL_PREFIX = '/api/templates/assets/moabom-basic/pwa/icons';

    /** 기본 theme/background — 사용자 포인트 컬러와 독립(manifest 는 런타임 CSS 변수를 못 읽음). */
    private const THEME_COLOR = '#6366f1';

    private const BACKGROUND_COLOR = '#ffffff';

    /**
     * Manifest JSON 본문 조립(Req 3.1/3.2/3.3/3.4/3.5).
     *
     * @param  string  $acceptLanguage  요청 `Accept-Language` 헤더(빈 문자열 허용)
     * @return array<string, mixed>
     */
    public function build(string $acceptLanguage): array
    {
        $locale = $this->negotiateLocale($acceptLanguage);

        $name = $this->translate('pwa.name', $locale, 'Moabom');
        $shortName = $this->translate('pwa.short_name', $locale, 'Moabom');
        $description = $this->translate('pwa.description', $locale, 'Moabom');

        return [
            'name' => $name,
            'short_name' => $shortName,
            'description' => $description,
            'start_url' => '/',
            'scope' => '/',
            'display' => 'standalone',
            'orientation' => 'any',
            'lang' => $locale,
            'dir' => 'ltr',
            'theme_color' => self::THEME_COLOR,
            'background_color' => self::BACKGROUND_COLOR,
            'icons' => [
                [
                    'src' => self::ICON_URL_PREFIX.'/icon-192.png',
                    'sizes' => '192x192',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src' => self::ICON_URL_PREFIX.'/icon-512.png',
                    'sizes' => '512x512',
                    'type' => 'image/png',
                    'purpose' => 'any maskable',
                ],
                [
                    'src' => self::ICON_URL_PREFIX.'/apple-touch-icon-180.png',
                    'sizes' => '180x180',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ],
            ],
        ];
    }

    /**
     * `Accept-Language` → 지원 로케일 매칭. RFC 4647 의 기본적인 prefix 매칭만 구현한다.
     * 매칭 실패 시 `app.fallback_locale` 반환.
     */
    private function negotiateLocale(string $acceptLanguage): string
    {
        $supported = Config::get('app.supported_locales');
        if (! is_array($supported) || $supported === []) {
            $supported = ['ko', 'en'];
        }
        $fallback = (string) Config::get('app.fallback_locale', 'en');

        if ($acceptLanguage === '') {
            return $fallback;
        }

        // 쉼표로 분리, 품질값(`;q=0.9`) 제거, 대소문자 무시.
        $tags = [];
        foreach (explode(',', $acceptLanguage) as $chunk) {
            $tag = trim(explode(';', $chunk, 2)[0] ?? '');
            if ($tag !== '') {
                $tags[] = strtolower($tag);
            }
        }

        foreach ($tags as $tag) {
            // 완전 일치
            foreach ($supported as $locale) {
                if (strtolower((string) $locale) === $tag) {
                    return (string) $locale;
                }
            }
            // prefix 일치 (ko-KR → ko)
            $primary = explode('-', $tag, 2)[0];
            foreach ($supported as $locale) {
                if (strtolower((string) $locale) === $primary) {
                    return (string) $locale;
                }
            }
        }

        return $fallback;
    }

    /**
     * `moabom-pwa::pwa.*` 번역 키 조회. 키가 없으면 fallback 문자열 반환.
     */
    private function translate(string $key, string $locale, string $fallback): string
    {
        $full = 'moabom-pwa::'.$key;
        $translated = Lang::get($full, [], $locale);

        // Lang::get 는 키 부재 시 원본 키 문자열을 반환한다.
        if (! is_string($translated) || $translated === $full) {
            return $fallback;
        }

        return $translated;
    }
}
