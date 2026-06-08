<?php

namespace Modules\Moabom\System\Http\Middleware;

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

        $host = TenantRequestHost::resolve($request);
        $parser = new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        );
        $parsed = $parser->parse($host);

        if ($parsed['type'] === 'unknown') {
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
