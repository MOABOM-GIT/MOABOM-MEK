<?php

namespace Modules\Moabom\Presence\Support;

use Illuminate\Http\Request;

/**
 * 테넌트·플랫폼 접속자 heartbeat 에 사용하는 세션 키 SSOT.
 */
final class PresenceSessionKeyResolver
{
    public function resolve(Request $request): string
    {
        $header = trim((string) $request->header('X-Moabom-Presence-Key', ''));
        if ($header !== '' && strlen($header) <= 128) {
            return $this->hashClientKey($header);
        }

        return $this->resolveFromLaravelSession($request);
    }

    public function resolveFromLaravelSession(Request $request): string
    {
        return hash('sha256', 'presence:session:'.(string) $request->session()->getId());
    }

    public function hashClientKey(string $clientKey): string
    {
        return hash('sha256', 'presence:'.$clientKey);
    }
}
