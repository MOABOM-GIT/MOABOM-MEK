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

        if (! $this->hasFrameAncestorsCsp($response) && ! $response->headers->has('X-Frame-Options')) {
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

    private function hasFrameAncestorsCsp(Response $response): bool
    {
        foreach (['Content-Security-Policy', 'Content-Security-Policy-Report-Only'] as $header) {
            $value = $response->headers->get($header);
            if (is_string($value) && str_contains($value, 'frame-ancestors')) {
                return true;
            }
        }

        return false;
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
            $this->buildFrameSrcDirective(),
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

    /**
     * Moabom AI 생성앱 iframe (apps.mek360.com / {id}.apps.mek360.com) 및
     * website_link 외부 HTTPS embed 허용.
     *
     * frame-src 미지정 시 default-src 'self' 가 iframe 삽입을 막아 Report-Only 위반이 발생한다.
     * MOABOM_APPS_PREVIEW_* 는 moabom-apps 모듈과 동일 env 키를 공유한다.
     */
    private function buildFrameSrcDirective(): string
    {
        $sources = ["'self'"];

        foreach ($this->generatedAppFrameHosts() as $host) {
            $sources[] = 'https://'.$host;
            $sources[] = 'https://*.'.$host;
        }

        // website_link 앱 — 저장·검증된 외부 HTTPS URL iframe (Report-Only/enforce frame-src)
        $sources[] = 'https:';

        return 'frame-src '.implode(' ', array_values(array_unique($sources)));
    }

    /**
     * @return list<string>
     */
    private function generatedAppFrameHosts(): array
    {
        $hosts = [];

        foreach ([
            (string) env('MOABOM_APPS_PREVIEW_STANDARD_HOST', 'apps.mek360.com'),
            (string) env('MOABOM_APPS_PREVIEW_HOSTED_APPS_DOMAIN', 'apps.mek360.com'),
        ] as $candidate) {
            $host = strtolower(trim($candidate));
            if ($host !== '') {
                $hosts[] = $host;
            }
        }

        return array_values(array_unique($hosts));
    }
}
