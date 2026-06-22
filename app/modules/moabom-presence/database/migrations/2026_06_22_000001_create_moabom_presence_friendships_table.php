<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_presence_friendships')) {
            return;
        }

        Schema::create('moabom_presence_friendships', function (Blueprint $table): void {
            $table->id()->comment('친구 관계 ID');
            $table->foreignId('requester_id')->comment('요청자 사용자 ID')->constrained('users')->cascadeOnDelete();
            $table->foreignId('addressee_id')->comment('수신자 사용자 ID')->constrained('users')->cascadeOnDelete();
            $table->string('status', 16)->default('pending')->comment('상태(pending|accepted|declined|blocked)');
            $table->timestamp('accepted_at')->nullable()->comment('수락 시각');
            $table->timestamps();

            $table->unique(['requester_id', 'addressee_id'], 'moabom_presence_friendships_pair_uq');
            $table->index(['addressee_id', 'status'], 'moabom_presence_friendships_addressee_idx');
            $table->index(['requester_id', 'status'], 'moabom_presence_friendships_requester_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_presence_friendships');
    }
};
