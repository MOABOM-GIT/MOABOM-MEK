<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
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

    public function test_remember_shared_reuses_snapshot_when_local_cache_cold(): void
    {
        putenv('MOABOM_PUBLIC_BOOT_CACHE_TTL=60');
        $_ENV['MOABOM_PUBLIC_BOOT_CACHE_TTL'] = '60';
        config(['filesystems.default' => 'gcs']);
        Storage::fake('gcs');

        $localKey = 'moabom.test.shared.'.uniqid('', true);
        $objectPath = 'moabom/public-boot-cache/test/'.uniqid('', true).'.json';
        $calls = 0;

        $first = MoabomPublicApiCache::rememberShared($localKey, $objectPath, function () use (&$calls) {
            $calls++;

            return ['v' => 1];
        });

        // 다른 인스턴스 시뮬레이션 — per-instance 캐시만 비운다.
        Cache::forget($localKey);

        $second = MoabomPublicApiCache::rememberShared($localKey, $objectPath, function () use (&$calls) {
            $calls++;

            return ['v' => 2];
        });

        $this->assertSame(['v' => 1], $first);
        $this->assertSame(['v' => 1], $second);
        $this->assertSame(1, $calls);
        Storage::disk('gcs')->assertExists($objectPath);
    }

    public function test_remember_shared_ignores_snapshot_when_cache_key_differs(): void
    {
        putenv('MOABOM_PUBLIC_BOOT_CACHE_TTL=60');
        $_ENV['MOABOM_PUBLIC_BOOT_CACHE_TTL'] = '60';
        config(['filesystems.default' => 'gcs']);
        Storage::fake('gcs');

        $objectPath = 'moabom/public-boot-cache/test/'.uniqid('', true).'.json';

        MoabomPublicApiCache::rememberShared('key.rev1.'.$objectPath, $objectPath, fn () => ['rev' => 1]);

        // revision 상승 → 새 localKey, 같은 objectPath → 스냅샷 stale → 콜백 재실행 + 덮어쓰기.
        $calls = 0;
        $result = MoabomPublicApiCache::rememberShared('key.rev2.'.$objectPath, $objectPath, function () use (&$calls) {
            $calls++;

            return ['rev' => 2];
        });

        $this->assertSame(['rev' => 2], $result);
        $this->assertSame(1, $calls);
    }

    public function test_remember_shared_skips_shared_layer_when_default_disk_not_gcs(): void
    {
        putenv('MOABOM_PUBLIC_BOOT_CACHE_TTL=60');
        $_ENV['MOABOM_PUBLIC_BOOT_CACHE_TTL'] = '60';
        config(['filesystems.default' => 'local']);

        $localKey = 'moabom.test.shared.local.'.uniqid('', true);
        $objectPath = 'moabom/public-boot-cache/test/'.uniqid('', true).'.json';
        $calls = 0;

        MoabomPublicApiCache::rememberShared($localKey, $objectPath, function () use (&$calls) {
            $calls++;

            return ['v' => 1];
        });

        // 다른 인스턴스 시뮬레이션 — 공유 계층이 없으므로 재구성해야 한다.
        Cache::forget($localKey);

        MoabomPublicApiCache::rememberShared($localKey, $objectPath, function () use (&$calls) {
            $calls++;

            return ['v' => 2];
        });

        $this->assertSame(2, $calls);
    }
}
