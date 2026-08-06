<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_smart_chat_conversations')) {
            Schema::create('moabom_smart_chat_conversations', function (Blueprint $table): void {
                $table->id()->comment('대화 PK');
                $table->foreignId('user_id')->comment('소유자')->constrained('users')->cascadeOnDelete();
                $table->uuid('uuid')->unique()->comment('외부 노출 UUID');
                $table->string('title', 200)->nullable()->comment('자동/수동 제목');
                $table->string('model_id', 64)->default('gemini-flash-lite')->comment('기본 모델 id');
                $table->timestamp('last_message_at')->nullable()->comment('마지막 메시지 시각');
                $table->timestamps();

                $table->index(['user_id', 'last_message_at']);
            });
        }

        if (! Schema::hasTable('moabom_smart_chat_messages')) {
            Schema::create('moabom_smart_chat_messages', function (Blueprint $table): void {
                $table->id()->comment('메시지 PK');
                $table->foreignId('conversation_id')->comment('대화 FK')
                    ->constrained('moabom_smart_chat_conversations')->cascadeOnDelete();
                $table->string('role', 16)->comment('user|assistant|system');
                $table->longText('content')->comment('텍스트 본문');
                $table->json('parts')->nullable()->comment('멀티모달 parts (P1+)');
                $table->string('status', 16)->default('complete')->comment('streaming|complete|error|cancelled');
                $table->string('model_id', 64)->nullable()->comment('생성에 사용된 모델');
                $table->unsignedInteger('prompt_tokens')->nullable()->comment('입력 토큰(추정)');
                $table->unsignedInteger('completion_tokens')->nullable()->comment('출력 토큰(추정)');
                $table->foreignId('parent_id')->nullable()->comment('분기 부모 (P2)')
                    ->constrained('moabom_smart_chat_messages')->nullOnDelete();
                $table->timestamps();

                $table->index(['conversation_id', 'id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_smart_chat_messages');
        Schema::dropIfExists('moabom_smart_chat_conversations');
    }
};
