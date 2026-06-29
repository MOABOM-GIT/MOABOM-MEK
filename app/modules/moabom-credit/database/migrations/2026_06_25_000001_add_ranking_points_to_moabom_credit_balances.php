<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('moabom_credit_balances')) {
            return;
        }

        if (! Schema::hasColumn('moabom_credit_balances', 'ranking_points')) {
            Schema::table('moabom_credit_balances', function (Blueprint $table): void {
                $table->unsignedBigInteger('ranking_points')
                    ->default(0)
                    ->after('balance')
                    ->comment('활동 순위용 누적 적립 포인트');
                $table->index('ranking_points', 'moabom_credit_balances_ranking_points_idx');
            });
        }

        if (! Schema::hasTable('moabom_credit_transactions')) {
            return;
        }

        $sourceTypes = [
            'login',
            'post_write',
            'like_received',
            'attendance',
            'comment_write',
        ];

        $totals = DB::table('moabom_credit_transactions')
            ->selectRaw('user_id, SUM(amount) AS total')
            ->where('type', 'earn')
            ->where('amount', '>', 0)
            ->whereNotNull('user_id')
            ->whereIn('source_type', $sourceTypes)
            ->groupBy('user_id')
            ->get();

        foreach ($totals as $row) {
            $userId = (int) $row->user_id;
            $total = (int) $row->total;
            if ($userId <= 0 || $total <= 0) {
                continue;
            }

            $updated = DB::table('moabom_credit_balances')
                ->where('user_id', $userId)
                ->update([
                    'ranking_points' => $total,
                    'updated_at' => now(),
                ]);

            if ($updated === 0) {
                DB::table('moabom_credit_balances')->insert([
                    'user_id' => $userId,
                    'balance' => 0,
                    'ranking_points' => $total,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('moabom_credit_balances')
            || ! Schema::hasColumn('moabom_credit_balances', 'ranking_points')) {
            return;
        }

        Schema::table('moabom_credit_balances', function (Blueprint $table): void {
            $table->dropIndex('moabom_credit_balances_ranking_points_idx');
            $table->dropColumn('ranking_points');
        });
    }
};
