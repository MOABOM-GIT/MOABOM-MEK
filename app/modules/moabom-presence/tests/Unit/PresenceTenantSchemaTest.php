<?php

namespace Modules\Moabom\Presence\Tests\Unit;

use Modules\Moabom\Presence\Support\PresenceTenantSchema;
use PHPUnit\Framework\TestCase;

final class PresenceTenantSchemaTest extends TestCase
{
    protected function tearDown(): void
    {
        PresenceTenantSchema::resetCacheForTest();
        parent::tearDown();
    }

    public function test_pick_writable_columns_keeps_only_existing_keys_in_order(): void
    {
        $schema = new class extends PresenceTenantSchema {
            public function hasColumn(string $table, string $column): bool
            {
                return in_array($column, ['session_key', 'display_name', 'last_seen_at'], true);
            }

            public function hasTable(string $table): bool
            {
                return $table === PresenceTenantSchema::TABLE_TENANT_SESSIONS;
            }
        };

        $payload = $schema->pickWritableColumns(
            PresenceTenantSchema::TABLE_TENANT_SESSIONS,
            [
                'session_key' => 'abc',
                'display_name' => 'Guest',
                'client_form_factor' => 'desktop',
                'last_seen_at' => '2026-06-23',
                'unexpected' => 'drop-me',
            ],
            [
                'session_key',
                'display_name',
                'client_form_factor',
                'last_seen_at',
            ],
        );

        $this->assertSame([
            'session_key' => 'abc',
            'display_name' => 'Guest',
            'last_seen_at' => '2026-06-23',
        ], $payload);
    }
}
