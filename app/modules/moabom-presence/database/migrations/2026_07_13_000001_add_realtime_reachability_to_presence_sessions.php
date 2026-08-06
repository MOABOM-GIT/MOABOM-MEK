<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $table = 'moabom_presence_tenant_sessions';
        if (! Schema::hasTable($table)) {
            return;
        }

        $addReachable = ! Schema::hasColumn($table, 'ws_reachable_until');
        $addOnline = ! Schema::hasColumn($table, 'presence_online_until');
        $addWsState = ! Schema::hasColumn($table, 'ws_state');
        $addVisibility = ! Schema::hasColumn($table, 'visibility_state');

        Schema::table($table, function (Blueprint $blueprint) use (
            $addReachable,
            $addOnline,
            $addWsState,
            $addVisibility,
        ): void {
            if ($addReachable) {
                $blueprint->timestamp('ws_reachable_until')->nullable()->after('client_ip_masked');
            }
            if ($addOnline) {
                $blueprint->timestamp('presence_online_until')->nullable()->after('ws_reachable_until');
            }
            if ($addWsState) {
                $blueprint->string('ws_state', 16)->nullable()->after('presence_online_until');
            }
            if ($addVisibility) {
                $blueprint->string('visibility_state', 16)->nullable()->after('ws_state');
            }
        });

        if ($addReachable) {
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->index(
                    ['user_id', 'ws_reachable_until'],
                    'moabom_presence_user_ws_reachable_idx',
                );
            });
        }
    }

    public function down(): void
    {
        $table = 'moabom_presence_tenant_sessions';
        if (! Schema::hasTable($table)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($table): void {
            if (Schema::hasColumn($table, 'ws_reachable_until')) {
                $blueprint->dropIndex('moabom_presence_user_ws_reachable_idx');
            }
            $columns = collect([
                'ws_reachable_until',
                'presence_online_until',
                'ws_state',
                'visibility_state',
            ])->filter(fn (string $column): bool => Schema::hasColumn($table, $column))->all();
            if ($columns !== []) {
                $blueprint->dropColumn($columns);
            }
        });
    }
};
