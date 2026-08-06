<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Contracts\Extension\CacheInterface;

/**
 * SaaS file 캐시 키에 Host/tenant scope 를 붙여 template.language 등 cross-tenant 오염 방지.
 *
 * @see MoabomDbConfigRepository::cacheKey() — G7 settings 카테고리와 동일 패턴
 */
final class TenantScopedCacheDecorator implements CacheInterface
{
    public function __construct(
        private readonly CacheInterface $inner,
        private readonly TenantContext $tenantContext,
        private readonly TenantExtensionRevisionResolver $extensionRevision,
    ) {}

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->inner->get($this->scopeKey($key), $default);
    }

    public function put(string $key, mixed $value, ?int $ttl = null): bool
    {
        return $this->inner->put($this->scopeKey($key), $value, $ttl);
    }

    public function has(string $key): bool
    {
        return $this->inner->has($this->scopeKey($key));
    }

    public function forget(string $key): bool
    {
        return $this->inner->forget($this->scopeKey($key));
    }

    public function remember(string $key, callable $callback, ?int $ttl = null, array $tags = []): mixed
    {
        return $this->inner->remember($this->scopeKey($key), $callback, $ttl, $tags);
    }

    public function rememberQuery(string $queryHash, callable $callback, ?int $ttl = null, array $tags = []): mixed
    {
        return $this->inner->rememberQuery($queryHash, $callback, $ttl, $tags);
    }

    public function many(array $keys): array
    {
        $scoped = array_map(fn (string $k): string => $this->scopeKey($k), $keys);
        $result = $this->inner->many($scoped);
        $out = [];
        foreach ($keys as $i => $original) {
            $scopedKey = $scoped[$i];
            if (array_key_exists($scopedKey, $result)) {
                $out[$original] = $result[$scopedKey];
            }
        }

        return $out;
    }

    public function putMany(array $values, ?int $ttl = null): bool
    {
        $scoped = [];
        foreach ($values as $key => $value) {
            $scoped[$this->scopeKey((string) $key)] = $value;
        }

        return $this->inner->putMany($scoped, $ttl);
    }

    public function flush(): bool
    {
        return $this->inner->flush();
    }

    public function flushTags(array $tags): bool
    {
        return $this->inner->flushTags($tags);
    }

    public function refresh(string $key, callable $callback, ?int $ttl = null, array $tags = []): mixed
    {
        return $this->inner->refresh($this->scopeKey($key), $callback, $ttl, $tags);
    }

    public function supportsTags(): bool
    {
        return $this->inner->supportsTags();
    }

    public function getStore(): string
    {
        return $this->inner->getStore();
    }

    public function withStore(string $store): static
    {
        $wrapped = $this->inner->withStore($store);

        return $wrapped instanceof self
            ? $wrapped
            : new self($wrapped, $this->tenantContext, $this->extensionRevision);
    }

    public function resolveKey(string $key): string
    {
        return $this->inner->resolveKey($this->scopeKey($key));
    }

    private function scopeKey(string $key): string
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return $key;
        }

        if (str_starts_with($key, 'saas:')) {
            return $key;
        }

        $scope = $this->tenantContext->isPlatformRequest()
            ? 'platform'
            : ($this->tenantContext->tenantId() ?? '_unknown');

        if (
            str_starts_with($key, 'ext.modules.')
            || str_starts_with($key, 'ext.plugins.')
        ) {
            $key .= ':revision:'.$this->extensionRevision->current();
        }

        return 'saas:'.$scope.':'.$key;
    }
}
