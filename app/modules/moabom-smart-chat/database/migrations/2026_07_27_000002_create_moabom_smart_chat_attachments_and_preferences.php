<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_smart_chat_attachments')) {
            Schema::create('moabom_smart_chat_attachments', function (Blueprint $table): void {
                $table->id()->comment('첨부 PK');
                $table->foreignId('user_id')->comment('소유자')->constrained('users')->cascadeOnDelete();
                $table->foreignId('conversation_id')->nullable()->comment('대화 FK')
                    ->constrained('moabom_smart_chat_conversations')->nullOnDelete();
                $table->foreignId('message_id')->nullable()->comment('메시지 FK')
                    ->constrained('moabom_smart_chat_messages')->nullOnDelete();
                $table->uuid('uuid')->unique()->comment('외부 노출 UUID');
                $table->string('original_name', 255)->comment('원본 파일명');
                $table->string('mime', 127)->comment('MIME');
                $table->string('kind', 16)->comment('image|document');
                $table->unsignedBigInteger('size_bytes')->comment('바이트');
                $table->string('storage_path', 512)->comment('모듈 스토리지 상대 경로');
                $table->longText('extracted_text')->nullable()->comment('문서 텍스트 추출');
                $table->timestamps();

                $table->index(['user_id', 'id']);
            });
        }

        if (! Schema::hasTable('moabom_smart_chat_preferences')) {
            Schema::create('moabom_smart_chat_preferences', function (Blueprint $table): void {
                $table->id()->comment('PK');
                $table->foreignId('user_id')->unique()->comment('사용자')->constrained('users')->cascadeOnDelete();
                $table->text('custom_instructions')->nullable()->comment('사용자 커스텀 지시문');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_smart_chat_attachments');
        Schema::dropIfExists('moabom_smart_chat_preferences');
    }
};
