<?php

namespace Modules\Moabom\System\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Moabom\System\Saas\TenantHostParser;
use Symfony\Component\HttpFoundation\Response;

/**
 * /platform/* API 는 Host 파싱으로 mek360.com(플랫폼)에서만 통과.
 *
 * Route middleware 만으로는 ModuleRouteServiceProvider·LB 조합에서 auth(401)가
 * 먼저 새 나올 수 있으므로 api 그룹 최상단에서 path+Host 로 차단한다.
 */
final class RestrictPlatformApiToPlatformHost
{
    private const PLATFORM_API_PREFIX = 'api/modules/moabom-system/platform/';

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return $next($request);
        }

        $path = ltrim((string) $request->path(), '/');
        if (! str_starts_with($path, self::PLATFORM_API_PREFIX)) {
            return $next($request);
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
