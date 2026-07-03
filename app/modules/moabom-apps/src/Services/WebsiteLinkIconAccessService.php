<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Crypt;

/**
 * 웹사이트 연결 앱 파비콘 서빙용 단기 접근 토큰.
 *
 * 셸 &lt;img src&gt; 는 Bearer 를 실을 수 없으므로, 비공개 앱 아이콘은
 * Crypt 서명 쿼리(icon_token)로만 게스트 접근을 허용한다.
 */
class WebsiteLinkIconAccessService
{
    private const PURPOSE = 'website_icon';

    public function issueToken(int $appId): string
    {
        $ttl = max(
            86400,
            (int) config('moabom-apps.website_link.icon_access_token_ttl_seconds', 2_592_000),
        );

        return Crypt::encryptString(json_encode([
            'app_id' => $appId,
            'purpose' => self::PURPOSE,
            'exp' => now()->addSeconds($ttl)->timestamp,
        ], JSON_THROW_ON_ERROR));
    }

    public function validatesAccess(int $appId, ?string $token): bool
    {
        if ($token === null || $token === '') {
            return false;
        }

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
        if ($exp > 0 && $exp < now()->timestamp) {
            return false;
        }

        return true;
    }

    public function appendTokenToIconPath(string $path, int $appId): string
    {
        $separator = str_contains($path, '?') ? '&' : '?';

        return $path.$separator.'icon_token='.rawurlencode($this->issueToken($appId));
    }
}
