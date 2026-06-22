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

        if (Schema::hasColumn('moabom_presence_tenant_sessions', 'client_form_factor')) {
            return;
        }

        Schema::table('moabom_presence_tenant_sessions', function (Blueprint $table): void {
            $table->string('client_form_factor', 16)
                ->nullable()
                ->after('is_authenticated')
                ->comment('접속 단말: desktop|mobile');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_presence_tenant_sessions')) {
            return;
        }

        if (! Schema::hasColumn('moabom_presence_tenant_sessions', 'client_form_factor')) {
            return;
        }

        Schema::table('moabom_presence_tenant_sessions', function (Blueprint $table): void {
            $table->dropColumn('client_form_factor');
        });
    }
};
