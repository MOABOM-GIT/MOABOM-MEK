<?php

namespace Modules\Moabom\Social\Auth\Support;

/**
 * 지원 SNS provider id SSOT.
 */
final class SocialAuthProviders
{
    /** @var list<string> */
    public const ALL = ['google', 'kakao', 'naver'];

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return self::ALL;
    }

    public static function isSupported(string $provider): bool
    {
        return in_array($provider, self::ALL, true);
    }
}
