<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit;

use Illuminate\Support\Facades\Cache;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Tests\TestCase;

class MoabomPublicApiCacheTest extends TestCase
{
    public function test_remember_uses_ttl_when_configured(): void
    {
        putenv('MOABOM_PUBLIC_BOOT_CACHE_TTL=60');
        $_ENV['MOABOM_PUBLIC_BOOT_CACHE_TTL'] = '60';

        $key = 'moabom.test.cache.'.uniqid('', true);
        $calls = 0;

        $first = MoabomPublicApiCache::remember($key, function () use (&$calls) {
            $calls++;

            return ['ok' => true];
        });
        $second = MoabomPublicApiCache::remember($key, function () use (&$calls) {
            $calls++;

            return ['ok' => false];
        });

        $this->assertSame(['ok' => true], $first);
        $this->assertSame(['ok' => true], $second);
        $this->assertSame(1, $calls);

        Cache::forget($key);
    }

    public function test_remember_skips_cache_when_ttl_zero(): void
    {
        putenv('MOABOM_PUBLIC_BOOT_CACHE_TTL=0');
        $_ENV['MOABOM_PUBLIC_BOOT_CACHE_TTL'] = '0';

        $key = 'moabom.test.cache.zero.'.uniqid('', true);
        $calls = 0;

        MoabomPublicApiCache::remember($key, function () use (&$calls) {
            $calls++;

            return 1;
        });
        MoabomPublicApiCache::remember($key, function () use (&$calls) {
            $calls++;

            return 2;
        });

        $this->assertSame(2, $calls);
    }
}
