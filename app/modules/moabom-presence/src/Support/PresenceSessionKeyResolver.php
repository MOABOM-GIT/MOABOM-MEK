<?php

namespace Modules\Moabom\Presence\Support;

use Illuminate\Http\Request;

/**
 * 테넌트·플랫폼 접속자 heartbeat 에 사용하는 방문자·세션 키 SSOT.
 */
final class PresenceSessionKeyResolver
{
    public function resolveVisitorId(Request $request): string
    {
        $visitorHeader = trim((string) $request->header('X-Moabom-Visitor-Id', ''));
        if ($visitorHeader !== '' && strlen($visitorHeader) <= 128) {
            return $visitorHeader;
        }

        $legacyHeader = trim((string) $request->header('X-Moabom-Presence-Key', ''));
        if ($legacyHeader !== '' && strlen($legacyHeader) <= 128) {
            return $legacyHeader;
        }

        if ($request->hasSession()) {
            return 'session:'.$request->session()->getId();
        }

        throw new \RuntimeException('moabom_presence_visitor_id_required');
    }

    public function resolveSessionKeyFromVisitorId(string $visitorId): string
    {
        return hash('sha256', 'presence:visitor:'.$visitorId);
    }

    public function resolve(Request $request): string
    {
        return $this->resolveSessionKeyFromVisitorId($this->resolveVisitorId($request));
    }

    public function resolveFromLaravelSession(Request $request): ?string
    {
        if (! $request->hasSession()) {
            return null;
        }

        return hash('sha256', 'presence:session:'.(string) $request->session()->getId());
    }

    /**
     * visitor_id 기준 canonical session_key 외 레거시 행 삭제용 키 목록.
     *
     * @return list<string>
     */
    public function legacySessionKeysForVisitor(
        Request $request,
        string $visitorId,
        string $canonicalSessionKey,
    ): array {
        $keys = [];

        $legacyClientKeyHash = $this->hashClientKey($visitorId);
        if ($legacyClientKeyHash !== $canonicalSessionKey) {
            $keys[] = $legacyClientKeyHash;
        }

        $sessionIdKey = $this->resolveFromLaravelSession($request);
        if ($sessionIdKey !== null && $sessionIdKey !== $canonicalSessionKey) {
            $keys[] = $sessionIdKey;
        }

        if (! str_starts_with($visitorId, 'session:') && $request->hasSession()) {
            $fallbackVisitorId = 'session:'.(string) $request->session()->getId();
            $fallbackKey = $this->resolveSessionKeyFromVisitorId($fallbackVisitorId);
            if ($fallbackKey !== $canonicalSessionKey) {
                $keys[] = $fallbackKey;
            }
        }

        return array_values(array_unique(array_filter($keys)));
    }

    /** @deprecated visitor_id 기반 resolveSessionKeyFromVisitorId 사용 */
    public function hashClientKey(string $clientKey): string
    {
        return hash('sha256', 'presence:'.$clientKey);
    }
}
