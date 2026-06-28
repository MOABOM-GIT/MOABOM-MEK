<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_presence_revisions')) {
            return;
        }

        Schema::create('moabom_presence_revisions', function (Blueprint $table): void {
            $table->id()->comment('접속 상태 revision ID');
            $table->string('scope_slug', 64)->comment('revision 범위 slug');
            $table->unsignedBigInteger('revision')->default(0)->comment('원자 증가 revision 값');
            $table->string('last_reason', 64)->nullable()->comment('마지막 revision 증가 사유');
            $table->timestamp('last_bumped_at')->nullable()->comment('마지막 revision 증가 시각');
            $table->timestamps();

            $table->unique('scope_slug', 'moabom_presence_revisions_scope_uq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_presence_revisions');
    }
};
