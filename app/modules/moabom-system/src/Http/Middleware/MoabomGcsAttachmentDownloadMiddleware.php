<?php

namespace Modules\Moabom\System\Http\Middleware;

use App\Services\AttachmentService;
use Closure;
use Illuminate\Http\Request;
use Modules\Moabom\System\Support\MoabomGcsAttachmentRegistrar;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * GCS 첨부파일 GET /api/attachment/{hash} 를 스트리밍으로 응답한다.
 */
class MoabomGcsAttachmentDownloadMiddleware
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! MoabomGcsAttachmentRegistrar::usesGcsAttachmentsDisk()) {
            return $next($request);
        }

        if (! $request->isMethod('GET') || ! $request->is('api/attachment/*')) {
            return $next($request);
        }

        $hash = (string) $request->route('hash', '');
        if ($hash === '') {
            return $next($request);
        }

        try {
            $response = app(AttachmentService::class)->download($hash, $request->user());
        } catch (\Throwable) {
            return $next($request);
        }

        if (! $response instanceof StreamedResponse) {
            return $next($request);
        }

        return $this->withCacheHeaders($response, $hash);
    }

    private function withCacheHeaders(StreamedResponse $response, string $hash): Response
    {
        $maxAge = (int) g7_core_settings('cache.layout_ttl', 86400);
        $etag = '"'.md5('gcs-attachment:'.$hash).'"';

        if (request()->header('If-None-Match') === $etag) {
            return response('', 304)->header('ETag', $etag);
        }

        $cacheControl = app()->environment('production')
            ? "public, max-age={$maxAge}, immutable"
            : 'no-cache';

        $response->headers->set('ETag', $etag);
        $response->headers->set('Cache-Control', $cacheControl);
        $response->headers->set('Expires', gmdate('D, d M Y H:i:s', time() + $maxAge).' GMT');

        return $response;
    }
}
