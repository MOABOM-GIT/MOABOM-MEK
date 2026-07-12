<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Crypt;

/**
 * 웹사이트 연결 앱 파비콘 서빙용 접근 토큰.
 *
 * 셸 &lt;img src&gt; 는 Bearer 를 실을 수 없으므로, 비공개 앱 아이콘은
 * 서명 쿼리(icon_token)로만 게스트 접근을 허용한다.
 *
 * HMAC TTL 버킷 토큰: 같은 appId·같은 TTL 창에서는 항상 동일 → HTTP/SW 캐시 히트.
 * 레거시 Crypt 토큰도 검증(전환기).
 */
class WebsiteLinkIconAccessService
{
    private const PURPOSE = 'website_icon';

    private const TOKEN_VERSION = 'v1';

    public function issueToken(int $appId): string
    {
        $ttl = $this->tokenTtlSeconds();
        $now = time();
        $bucketStart = (int) (floor($now / $ttl) * $ttl);
        $exp = $bucketStart + $ttl;

        return $this->encodeHmacToken($appId, $exp);
    }

    public function validatesAccess(int $appId, ?string $token): bool
    {
        if ($token === null || $token === '') {
            return false;
        }

        if ($this->validateHmacToken($appId, $token)) {
            return true;
        }

        return $this->validateLegacyCryptToken($appId, $token);
    }

    public function appendTokenToIconPath(string $path, int $appId): string
    {
        $separator = str_contains($path, '?') ? '&' : '?';

        return $path.$separator.'icon_token='.rawurlencode($this->issueToken($appId));
    }

    private function tokenTtlSeconds(): int
    {
        return max(
            86400,
            (int) config('moabom-apps.website_link.icon_access_token_ttl_seconds', 2_592_000),
        );
    }

    private function encodeHmacToken(int $appId, int $exp): string
    {
        $mac = $this->mac($appId, $exp);

        return self::TOKEN_VERSION.'.'.$appId.'.'.$exp.'.'.$mac;
    }

    private function validateHmacToken(int $appId, string $token): bool
    {
        $parts = explode('.', $token, 4);
        if (count($parts) !== 4 || $parts[0] !== self::TOKEN_VERSION) {
            return false;
        }

        $tokenAppId = (int) $parts[1];
        $exp = (int) $parts[2];
        $mac = $parts[3];

        if ($tokenAppId !== $appId || $exp <= 0 || $mac === '') {
            return false;
        }

        if ($exp < time()) {
            return false;
        }

        $expected = $this->mac($tokenAppId, $exp);
        if (! hash_equals($expected, $mac)) {
            return false;
        }

        return true;
    }

    private function mac(int $appId, int $exp): string
    {
        return hash_hmac(
            'sha256',
            self::PURPOSE.'|'.$appId.'|'.$exp,
            $this->signingKey(),
        );
    }

    private function signingKey(): string
    {
        /** @var \Illuminate\Contracts\Encryption\Encrypter $encrypter */
        $encrypter = app('encrypter');

        return $encrypter->getKey();
    }

    private function validateLegacyCryptToken(int $appId, string $token): bool
    {
        try {
            $payload = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return false;
        }

        if (! is_array($payload)) {
            return false;
        }

        if (($payload['purpose'] ?? '') !== self::PURPOSE) {
            return false;
        }

        if ((int) ($payload['app_id'] ?? 0) !== $appId) {
            return false;
        }

        $exp = (int) ($payload['exp'] ?? 0);
        if ($exp > 0 && $exp < time()) {
            return false;
        }

        return true;
    }
}
