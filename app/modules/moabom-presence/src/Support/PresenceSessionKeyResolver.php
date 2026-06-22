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
            return hash('sha256', 'presence:'.$header);
        }

        $sessionId = (string) $request->session()->getId();

        return hash('sha256', 'presence:session:'.$sessionId);
    }
}
