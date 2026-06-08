<?php

namespace Modules\Moabom\System\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Moabom\System\Saas\TenantHostParser;
use Symfony\Component\HttpFoundation\Response;

/**
 * 플랫폼 Host(mek360.com) 전용 API — 테넌트 Host 에서는 404.
 *
 * TenantContext 가 아닌 Request Host 를 직접 판별한다.
 * (TenantContext 기본값 platform + middleware 순서에 의존하면 tenant Host 에서 401 이 새어 나올 수 있음)
 */
final class RequireMoabomPlatformHost
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('moabom-system.saas.enabled', false)) {
            abort(404);
        }

        $parser = new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        );

        if ($parser->parse((string) $request->getHost())['type'] !== 'platform') {
            abort(404);
        }

        return $next($request);
    }
}
