<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Cloud Run 공개 부트 API 응답 캐시 (Laravel file 캐시, TTL 기반).
 *
 * @see deploy/CLOUD-RUN-PERFORMANCE.md
 */
final class MoabomPublicApiCache
{
    public static function ttlSeconds(): int
    {
        $ttl = (int) config('cache.moabom_public_boot_ttl', config('cache.g7_json_settings_ttl', 300));

        return $ttl > 0 ? $ttl : 0;
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function remember(string $key, callable $callback): mixed
    {
        $ttl = self::ttlSeconds();
        if ($ttl <= 0) {
            return $callback();
        }

        return Cache::remember($key, $ttl, $callback);
    }

    public static function forget(string $key): void
    {
        Cache::forget($key);
    }

    /** @param  list<string>  $keys */
    public static function forgetMany(array $keys): void
    {
        foreach ($keys as $key) {
            self::forget($key);
        }
    }
}
