<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Moabom\System\Saas\TenantContext;
use Symfony\Component\HttpFoundation\Response;

/**
 * 테넌트 Host — 플랫폼 전용 admin SPA 차단.
 *
 * - `/admin/saas/*` 병원 목록·생성 (mek360.com 전용)
 * - `/admin/platform/settings/tenant` 레거시 병원 운영 설정 (제거 → 마이페이지 설정으로 유도)
 */
final class RestrictTenantHostPlatformAdminRoutes
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('moabom-system.saas.enabled', false) || ! app()->bound(TenantContext::class)) {
            return $next($request);
        }

        if (app(TenantContext::class)->isPlatformRequest()) {
            return $next($request);
        }

        $path = trim($request->path(), '/');

        if (str_starts_with($path, 'admin/saas')) {
            abort(404);
        }

        if ($path === 'admin/platform/settings/tenant') {
            return redirect('/admin/platform/settings/mypage', 302);
        }

        return $next($request);
    }
}
