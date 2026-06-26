<?php

namespace Modules\Moabom\Presence\Support;

use Illuminate\Http\Request;

/** 접속자 목록 guest 부제 — 마스킹된 클라이언트 IP (예: 123.158.*.*) */
final class PresenceClientIpMasker
{
    public function maskFromRequest(Request $request): ?string
    {
        return $this->mask((string) $request->ip());
    }

    public function mask(string $ip): ?string
    {
        $ip = trim($ip);
        if ($ip === '') {
            return null;
        }

        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            if (count($parts) === 4) {
                return $parts[0].'.'.$parts[1].'.*.*';
            }

            return null;
        }

        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $segments = explode(':', $ip);
            $head = array_values(array_filter($segments, static fn (string $part): bool => $part !== ''));
            if ($head === []) {
                return null;
            }
            $first = $head[0];
            $second = $head[1] ?? '0';

            return $first.':'.$second.':*';
        }

        return null;
    }
}
