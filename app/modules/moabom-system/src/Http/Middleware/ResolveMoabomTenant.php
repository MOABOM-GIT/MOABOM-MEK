<?php

namespace Modules\Moabom\System\Http\Middleware;

use App\Extension\HookManager;
use Closure;
use Illuminate\Http\Request;
use Modules\Moabom\System\Saas\SaasCachedConfigBridge;
use Modules\Moabom\System\Saas\TenantHostParser;
use Modules\Moabom\System\Saas\TenantRequestHost;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;
use Symfony\Component\HttpFoundation\Response;

/**
 * Host → TenantRuntimeBootstrap (DB·GCS·G7 config).
 *
 * MOABOM_SAAS_ENABLED=false 이면 no-op.
 */
class ResolveMoabomTenant
{
    public function __construct(
        private readonly TenantRuntimeBootstrap $runtimeBootstrap,
    ) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        SaasCachedConfigBridge::applyIfNeeded();

        if (! config('moabom-system.saas.enabled', false)) {
            return $next($request);
        }

        if ($request->is('api/modules/moabom-system/public/ready')) {
            // Cloud Run probe의 내부 Host는 tenant 도메인이 아니다.
            return $next($request);
        }

        if (
            config('moabom-system.queue_plane.runtime_role', 'web') === 'queue'
            && (
                (
                    $request->is('api/modules/moabom-system/internal/queue/*')
                    && trim((string) $request->header('X-CloudTasks-TaskName', '')) !== ''
                )
                || (
                    $request->is('api/modules/moabom-system/internal/scheduler/*')
                    && trim((string) $request->header('X-CloudScheduler-JobName', '')) !== ''
                )
            )
        ) {
            // Cloud Tasks payload의 slug를 controller가 적용한다. run.app host를 tenant로 해석하지 않는다.
            return $next($request);
        }

        $host = TenantRequestHost::resolve($request);
        $parser = new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        );
        $parsed = $parser->parse($host);
        $parsed = HookManager::applyFilters('moabom.saas.override_host_parse', $parsed, $host, $request);
        if (! is_array($parsed) || ! isset($parsed['type'], $parsed['host'])) {
            $parsed = $parser->parse($host);
        }

        if ($parsed['type'] === 'unknown') {
            $resolved = HookManager::applyFilters('moabom.saas.resolve_unknown_host', null, $host, $request);
            if (is_array($resolved) && ($resolved['type'] ?? '') === 'platform') {
                $this->runtimeBootstrap->bootstrapPlatform($request, [
                    'type' => 'platform',
                    'host' => (string) ($resolved['host'] ?? $host),
                ]);
                foreach ((array) ($resolved['attributes'] ?? []) as $key => $value) {
                    $request->attributes->set((string) $key, $value);
                }

                return $next($request);
            }

            return $this->runtimeBootstrap->tenantNotFoundResponse($host);
        }

        if ($parsed['type'] === 'platform') {
            $this->runtimeBootstrap->bootstrapPlatform($request, $parsed);

            return $next($request);
        }

        $tenant = $this->runtimeBootstrap->resolveTenant($parsed['host']);
        if ($tenant === null || ! $tenant->isActive()) {
            return $this->runtimeBootstrap->tenantNotFoundResponse($parsed['host']);
        }

        $this->runtimeBootstrap->bootstrapTenant($request, $parsed, $tenant);

        return $next($request);
    }
}
