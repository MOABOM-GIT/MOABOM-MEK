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
            Schema::create('moabom_credit_balances', function (Blueprint $table) {
                $table->id()->comment('크레딧 잔액 ID');
                $table->foreignId('user_id')
                    ->unique()
                    ->comment('사용자 ID')
                    ->constrained('users')
                    ->cascadeOnDelete();
                $table->unsignedBigInteger('balance')->default(0)->comment('보유 크레딧 잔액');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('moabom_credit_transactions')) {
            Schema::create('moabom_credit_transactions', function (Blueprint $table) {
                $table->id()->comment('크레딧 거래 ID');
                $table->foreignId('user_id')
                    ->nullable()
                    ->comment('사용자 ID')
                    ->constrained('users')
                    ->nullOnDelete();
                $table->string('type', 20)->comment('거래 유형 (earn: 적립, spend: 사용, adjust: 조정, expire: 만료)');
                $table->bigInteger('amount')->comment('거래 크레딧 증감액');
                $table->unsignedBigInteger('balance_after')->comment('거래 후 크레딧 잔액');
                $table->string('description')->nullable()->comment('거래 설명');
                $table->string('source_type')->nullable()->index()->comment('거래 출처 유형');
                $table->string('source_id')->nullable()->index()->comment('거래 출처 식별자');
                $table->json('meta')->nullable()->comment('거래 부가 정보');
                $table->timestamps();

                $table->index(['user_id', 'created_at']);
                $table->index(['user_id', 'type']);
            });
        }

        if (DB::getDriverName() === 'mysql') {
            if (Schema::hasTable('moabom_credit_balances')) {
                Schema::table('moabom_credit_balances', function (Blueprint $table) {
                    $table->comment('모아봄 크레딧 사용자 잔액');
                });
            }
            if (Schema::hasTable('moabom_credit_transactions')) {
                Schema::table('moabom_credit_transactions', function (Blueprint $table) {
                    $table->comment('모아봄 크레딧 거래 원장');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('moabom_credit_transactions');
        Schema::dropIfExists('moabom_credit_balances');
    }
};
