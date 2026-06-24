<?php

namespace Modules\Moabom\Presence\Support;

use Illuminate\Support\Facades\Schema;

/**
 * 테넌트 DB presence 스키마 SSOT.
 *
 * heartbeat·설정 upsert 는 마이그레이션 롤아웃 중에도 500 이 아닌
 * 스키마에 맞는 컬럼만 기록하도록 이 클래스를 통해서만 컬럼 존재를 판단합니다.
 */
final class PresenceTenantSchema
{
    public const TABLE_TENANT_SESSIONS = 'moabom_presence_tenant_sessions';

    public const TABLE_USER_PREFERENCES = 'moabom_presence_user_preferences';

    /** @var array<string, bool> */
    private static array $tableCache = [];

    /** @var array<string, bool> */
    private static array $columnCache = [];

    public function hasTable(string $table): bool
    {
        return self::$tableCache[$table] ??= Schema::hasTable($table);
    }

    public function hasColumn(string $table, string $column): bool
    {
        $cacheKey = $table.'.'.$column;

        return self::$columnCache[$cacheKey] ??= (
            $this->hasTable($table) && Schema::hasColumn($table, $column)
        );
    }

    public function isTenantSessionsReady(): bool
    {
        return $this->hasTable(self::TABLE_TENANT_SESSIONS)
            && $this->hasColumn(self::TABLE_TENANT_SESSIONS, 'session_key')
            && $this->hasColumn(self::TABLE_TENANT_SESSIONS, 'last_seen_at');
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  list<string>  $columns
     * @return array<string, mixed>
     */
    public function pickWritableColumns(string $table, array $attributes, array $columns): array
    {
        if (! $this->hasTable($table)) {
            return [];
        }

        $payload = [];
        foreach ($columns as $column) {
            if (! array_key_exists($column, $attributes)) {
                continue;
            }
            if ($this->hasColumn($table, $column)) {
                $payload[$column] = $attributes[$column];
            }
        }

        return $payload;
    }

    /** @internal 테스트에서 캐시 초기화 */
    public static function resetCacheForTest(): void
    {
        self::$tableCache = [];
        self::$columnCache = [];
    }
}
