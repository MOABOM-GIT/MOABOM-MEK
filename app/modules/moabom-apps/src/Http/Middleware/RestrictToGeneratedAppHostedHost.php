<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Support\GeneratedAppHostParser;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * dedicated_host Hosted 오리진({id}.apps.mek360.com) 전용 /api/data/* 게이트.
 */
final class RestrictToGeneratedAppHostedHost
{
    public function __construct(
        private readonly GeneratedAppHostParser $hostParser,
    ) {
    }

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $parsed = $this->hostParser->parse((string) $request->getHost());
        if ($parsed['type'] !== 'hosted' || $parsed['app_id'] === null) {
            throw new NotFoundHttpException;
        }

        $request->attributes->set('moabom_generated_app_id', $parsed['app_id']);

        return $next($request);
    }
}
