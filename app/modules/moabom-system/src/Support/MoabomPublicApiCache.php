<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Cloud Run 공개 부트 API 응답 캐시.
 *
 * 2계층:
 *  1. per-instance Laravel 캐시(file 드라이버, TTL) — 같은 인스턴스 내 가장 빠른 경로.
 *  2. 인스턴스 간 공유 GCS 스냅샷(`rememberShared`) — 콜드스타트·오토스케일·신규 테넌트로
 *     새 인스턴스가 떠도 재구성 없이 임계 경로(shell-boot)를 즉시 응답.
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

    /**
     * per-instance 캐시 → 공유 GCS 스냅샷 → 재구성 순서의 read-through.
     *
     * 콜백은 항상 non-null 배열을 반환하거나 예외를 던진다고 가정한다(예: shell-boot).
     * 예외는 캐시에 남기지 않고 그대로 전파한다.
     *
     * @template T
     *
     * @param  string  $localKey  per-instance 캐시 키(revision 등 포함 — 내용 변경 시 자동 miss)
     * @param  string  $sharedObjectPath  공유 GCS 오브젝트 경로(tenant/template/scope 고정)
     * @param  callable(): T  $callback
     * @return T
     */
    public static function rememberShared(string $localKey, string $sharedObjectPath, callable $callback): mixed
    {
        $ttl = self::ttlSeconds();
        if ($ttl <= 0) {
            return $callback();
        }

        $local = Cache::get($localKey);
        if ($local !== null) {
            return $local;
        }

        $shared = self::readSharedSnapshot($sharedObjectPath, $localKey);
        if ($shared !== null) {
            Cache::put($localKey, $shared, $ttl);

            return $shared;
        }

        $value = $callback();
        Cache::put($localKey, $value, $ttl);
        self::writeSharedSnapshot($sharedObjectPath, $localKey, $value, $ttl);

        return $value;
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

    /**
     * 공유 스냅샷은 다중 인스턴스 GCS 환경에서만 활성(default disk = gcs).
     * dev/local 단일 인스턴스는 per-instance file 캐시로 충분하므로 스토리지를 오염시키지 않는다.
     */
    private static function sharedSnapshotEnabled(): bool
    {
        return config('filesystems.default') === 'gcs';
    }

    private static function sharedDisk(): Filesystem
    {
        return Storage::disk((string) config('filesystems.default'));
    }

    /**
     * @return mixed 유효 payload 또는 null(미존재·stale·오류)
     */
    private static function readSharedSnapshot(string $path, string $expectedKey): mixed
    {
        if (! self::sharedSnapshotEnabled()) {
            return null;
        }

        try {
            $disk = self::sharedDisk();
            if (! $disk->exists($path)) {
                return null;
            }

            $raw = $disk->get($path);
            if (! is_string($raw) || trim($raw) === '') {
                return null;
            }

            $decoded = json_decode(ltrim($raw, "\xEF\xBB\xBF"), true);
            if (! is_array($decoded)) {
                return null;
            }

            // revision·활성 모듈·설정 변경 → localKey 불일치 → stale
            if (($decoded['cache_key'] ?? null) !== $expectedKey) {
                return null;
            }

            $expiresAt = (int) ($decoded['expires_at'] ?? 0);
            if ($expiresAt > 0 && $expiresAt < time()) {
                return null;
            }

            return $decoded['payload'] ?? null;
        } catch (\Throwable $e) {
            Log::warning('MoabomPublicApiCache: shared snapshot read failed', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private static function writeSharedSnapshot(string $path, string $key, mixed $value, int $ttl): void
    {
        if (! self::sharedSnapshotEnabled()) {
            return;
        }

        try {
            $json = json_encode([
                'cache_key' => $key,
                'expires_at' => time() + $ttl,
                'stored_at' => now()->toIso8601String(),
                'payload' => $value,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            if ($json === false) {
                return;
            }

            self::sharedDisk()->put($path, $json);
        } catch (\Throwable $e) {
            Log::warning('MoabomPublicApiCache: shared snapshot write failed', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
