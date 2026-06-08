<?php

namespace Plugins\Moabom\Auth\Hardening\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeadersMiddleware
{
    private const PLUGIN_ID = 'moabom-auth-hardening';

    /**
     * 보안 응답 헤더를 추가합니다.
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        if (! $this->isEnabled()) {
            return $response;
        }

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('X-Permitted-Cross-Domain-Policies', 'none');

        if (! $response->headers->has('X-Frame-Options')) {
            $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        }

        if ($this->shouldApplyCsp($response)) {
            $header = $this->isReportOnly()
                ? 'Content-Security-Policy-Report-Only'
                : 'Content-Security-Policy';

            if (! $response->headers->has($header) && ! $response->headers->has('Content-Security-Policy')) {
                $response->headers->set($header, $this->buildCspPolicy($this->isReportOnly()));
            }
        }

        return $response;
    }

    private function isEnabled(): bool
    {
        return (bool) g7_plugin_settings(self::PLUGIN_ID, 'enabled', true)
            && (bool) g7_plugin_settings(self::PLUGIN_ID, 'security_headers_enabled', true);
    }

    private function isReportOnly(): bool
    {
        return (bool) g7_plugin_settings(self::PLUGIN_ID, 'csp_report_only_enabled', true);
    }

    private function shouldApplyCsp(Response $response): bool
    {
        $contentType = (string) $response->headers->get('Content-Type', '');

        if ($contentType === '') {
            return true;
        }

        return str_contains($contentType, 'text/html');
    }

    private function buildCspPolicy(bool $reportOnly): string
    {
        $directives = [
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'self'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data: https:",
            "style-src 'self' 'unsafe-inline' https:",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
            "connect-src 'self' https: ws: wss:",
            "form-action 'self'",
            "require-trusted-types-for 'script'",
        ];

        if (! $reportOnly) {
            $directives[] = 'upgrade-insecure-requests';
        }

        return implode('; ', $directives);
    }
}
