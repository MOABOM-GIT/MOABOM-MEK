<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 플랫폼 DB — visitor_id 기반 mirror 키.
 */
return new class extends Migration
{
    protected $connection = 'moabom_platform';

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        if (! $schema->hasTable('moabom_presence_platform_sessions')) {
            return;
        }

        if (! $schema->hasColumn('moabom_presence_platform_sessions', 'visitor_id')) {
            Schema::connection($this->connection)->table('moabom_presence_platform_sessions', function (Blueprint $table): void {
                $table->string('visitor_id', 128)->nullable()->after('session_key')
                    ->comment('브라우저 방문자 ID (tenant mirror SSOT)');
                $table->unique(
                    ['tenant_slug', 'visitor_id'],
                    'moabom_presence_platform_tenant_visitor_uq',
                );
            });
        }
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);

        if (! $schema->hasTable('moabom_presence_platform_sessions')) {
            return;
        }

        if ($schema->hasColumn('moabom_presence_platform_sessions', 'visitor_id')) {
            Schema::connection($this->connection)->table('moabom_presence_platform_sessions', function (Blueprint $table): void {
                $table->dropUnique('moabom_presence_platform_tenant_visitor_uq');
                $table->dropColumn('visitor_id');
            });
        }
    }
};
