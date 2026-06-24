<?php

namespace Modules\Moabom\Social\Auth\Support;

/**
 * SNS OAuth 콜백 URL 경로의 단일 출처.
 *
 * 관리자 화면에 표시하는 Callback URL과 `SocialProviderService`의 기본 redirect_uri가
 * 동일하게 `url()`(APP_URL 기준)을 사용하도록 맞춘다.
 */
final class SocialAuthCallback
{
    /**
     * 애플리케이션 루트 기준 콜백 경로(선행 슬래시 포함).
     */
    public static function relativePath(string $provider): string
    {
        return "/api/modules/moabom-social-auth/{$provider}/callback";
    }

    /**
     * `config('app.url')` 기준 절대 콜백 URL.
     */
    public static function absoluteUrl(string $provider): string
    {
        $baseUrl = rtrim((string) config('app.url', ''), '/');
        if ($baseUrl === '') {
            $baseUrl = rtrim(url('/'), '/');
        }

        return $baseUrl.self::relativePath($provider);
    }

    /**
     * 관리자 설정 API의 `callback_urls` 응답용 맵.
     *
     * @return array<string, string>
     */
    public static function allAbsoluteUrls(): array
    {
        $urls = [];
        foreach (SocialAuthProviders::all() as $provider) {
            $urls[$provider] = self::absoluteUrl($provider);
        }

        return $urls;
    }
}
