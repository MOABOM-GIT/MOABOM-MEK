<?php

namespace Modules\Moabom\Presence\Repositories;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Presence\Contracts\PresenceRevisionRepositoryInterface;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

class PresenceRevisionRepository implements PresenceRevisionRepositoryInterface
{
    private const TABLE = 'moabom_presence_revisions';

    /** @var array<string, bool> */
    private array $tableReady = [];

    public function __construct(
        private PlatformConnectionFactory $platformConnections,
    ) {}

    public function currentTenant(string $tenantSlug): int
    {
        return $this->current(null, $tenantSlug, $this->tenantFallbackKey($tenantSlug));
    }

    public function bumpTenant(string $tenantSlug, string $reason): int
    {
        return $this->bump(null, $tenantSlug, $reason, $this->tenantFallbackKey($tenantSlug));
    }

    public function currentPlatform(): int
    {
        return $this->current('moabom_platform', 'platform', $this->platformFallbackKey());
    }

    public function bumpPlatform(string $reason): int
    {
        return $this->bump('moabom_platform', 'platform', $reason, $this->platformFallbackKey());
    }

    private function current(?string $connectionName, string $scopeSlug, string $fallbackKey): int
    {
        if (! $this->isTableReady($connectionName)) {
            return (int) Cache::get($fallbackKey, 0);
        }

        try {
            $row = $this->connection($connectionName)
                ->table(self::TABLE)
                ->where('scope_slug', $scopeSlug)
                ->first(['revision']);

            return $row ? (int) $row->revision : (int) Cache::get($fallbackKey, 0);
        } catch (\Throwable) {
            return (int) Cache::get($fallbackKey, 0);
        }
    }

    private function bump(?string $connectionName, string $scopeSlug, string $reason, string $fallbackKey): int
    {
        if (! $this->isTableReady($connectionName)) {
            return (int) Cache::increment($fallbackKey);
        }

        try {
            $now = now();
            $connection = $this->connection($connectionName);
            $seedRevision = max((int) Cache::get($fallbackKey, 0), time());

            return (int) $connection->transaction(function () use ($connection, $now, $reason, $scopeSlug, $seedRevision): int {
                $connection->table(self::TABLE)->insertOrIgnore([
                    'scope_slug' => $scopeSlug,
                    'revision' => $seedRevision,
                    'last_reason' => null,
                    'last_bumped_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $row = $connection->table(self::TABLE)
                    ->where('scope_slug', $scopeSlug)
                    ->lockForUpdate()
                    ->first(['revision']);

                $revision = (int) ($row?->revision ?? 0) + 1;

                $connection->table(self::TABLE)
                    ->where('scope_slug', $scopeSlug)
                    ->update([
                        'revision' => $revision,
                        'last_reason' => mb_substr($reason, 0, 64),
                        'last_bumped_at' => $now,
                        'updated_at' => $now,
                    ]);

                return $revision;
            });
        } catch (\Throwable) {
            return (int) Cache::increment($fallbackKey);
        }
    }

    private function connection(?string $connectionName): ConnectionInterface
    {
        if ($connectionName === 'moabom_platform') {
            $this->platformConnections->registerConnection();
        }

        return $connectionName ? DB::connection($connectionName) : DB::connection();
    }

    private function isTableReady(?string $connectionName): bool
    {
        $cacheKey = $connectionName ?: 'tenant';
        if (($this->tableReady[$cacheKey] ?? false) === true) {
            return true;
        }

        try {
            if ($connectionName === 'moabom_platform') {
                $this->platformConnections->registerConnection();
            }

            $ready = $connectionName
                ? Schema::connection($connectionName)->hasTable(self::TABLE)
                : Schema::hasTable(self::TABLE);
            if ($ready) {
                $this->tableReady[$cacheKey] = true;
            }

            return $ready;
        } catch (\Throwable) {
            return false;
        }
    }

    private function tenantFallbackKey(string $tenantSlug): string
    {
        return 'moabom-presence:revision:'.$tenantSlug;
    }

    private function platformFallbackKey(): string
    {
        return 'moabom-presence:revision:platform';
    }
}
