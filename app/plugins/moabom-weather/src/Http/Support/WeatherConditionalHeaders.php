<?php

namespace Plugins\Moabom\Weather\Http\Support;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * Weather_Current_API 조건부 응답(ETag · Last-Modified · 304) 헬퍼.
 *
 * 캐시 그리드(0.1°) + 언어 + `fetched_at` 으로 약한 ETag 를 구성한다.
 * 클라이언트 `If-None-Match` / `If-Modified-Since` 와 일치하면 본문 없이 304 를 반환한다.
 */
final class WeatherConditionalHeaders
{
    private const MAX_CONDITIONAL_HEADER_LENGTH = 256;

    /**
     * @return array{ETag: string, Last-Modified: string, Cache-Control: string}
     */
    public static function build(float $lat, float $lon, string $lang, string $fetchedAt): array
    {
        $gridLat = round($lat, 1);
        $gridLon = round($lon, 1);
        $etag = sprintf('W/"mw:%.1f:%.1f:%s:%s"', $gridLat, $gridLon, $lang, $fetchedAt);
        $lastModified = self::toHttpDate($fetchedAt);

        return [
            'ETag' => $etag,
            'Last-Modified' => $lastModified,
            'Cache-Control' => 'private, max-age=300',
        ];
    }

    /**
     * @param  array{ETag: string, Last-Modified: string}  $headers
     */
    public static function matchesNotModified(Request $request, array $headers): bool
    {
        $ifNoneMatch = $request->header('If-None-Match');
        if (is_string($ifNoneMatch) && $ifNoneMatch !== '') {
            if (strlen($ifNoneMatch) > self::MAX_CONDITIONAL_HEADER_LENGTH) {
                return false;
            }

            foreach (explode(',', $ifNoneMatch) as $candidate) {
                $candidate = trim($candidate);
                if ($candidate === '*' || $candidate === $headers['ETag']) {
                    return true;
                }
            }
        }

        $ifModifiedSince = $request->header('If-Modified-Since');
        if (
            is_string($ifModifiedSince)
            && $ifModifiedSince !== ''
            && strlen($ifModifiedSince) <= self::MAX_CONDITIONAL_HEADER_LENGTH
        ) {
            $since = strtotime($ifModifiedSince);
            $lastModified = strtotime($headers['Last-Modified']);
            if ($since !== false && $lastModified !== false && $since >= $lastModified) {
                return true;
            }
        }

        return false;
    }

    private static function toHttpDate(string $fetchedAt): string
    {
        try {
            return CarbonImmutable::parse($fetchedAt)->toRfc7231String();
        } catch (\Throwable) {
            return CarbonImmutable::now()->toRfc7231String();
        }
    }
}
