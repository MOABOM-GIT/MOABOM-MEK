<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_presence_tenant_sessions')) {
            return;
        }

        if (! Schema::hasColumn('moabom_presence_tenant_sessions', 'visitor_id')) {
            Schema::table('moabom_presence_tenant_sessions', function (Blueprint $table): void {
                $table->string('visitor_id', 128)->nullable()->after('session_key')
                    ->comment('브라우저 방문자 ID (X-Moabom-Visitor-Id SSOT)');
                $table->unique('visitor_id', 'moabom_presence_tenant_sessions_visitor_uq');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_presence_tenant_sessions')) {
            return;
        }

        if (Schema::hasColumn('moabom_presence_tenant_sessions', 'visitor_id')) {
            Schema::table('moabom_presence_tenant_sessions', function (Blueprint $table): void {
                $table->dropUnique('moabom_presence_tenant_sessions_visitor_uq');
                $table->dropColumn('visitor_id');
            });
        }
    }
};
