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

        if (! Schema::hasColumn('moabom_presence_tenant_sessions', 'client_ip_masked')) {
            Schema::table('moabom_presence_tenant_sessions', function (Blueprint $table): void {
                $table->string('client_ip_masked', 48)->nullable()->after('client_form_factor')
                    ->comment('마스킹된 클라이언트 IP (guest 부제 표시)');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_presence_tenant_sessions')) {
            return;
        }

        if (Schema::hasColumn('moabom_presence_tenant_sessions', 'client_ip_masked')) {
            Schema::table('moabom_presence_tenant_sessions', function (Blueprint $table): void {
                $table->dropColumn('client_ip_masked');
            });
        }
    }
};
