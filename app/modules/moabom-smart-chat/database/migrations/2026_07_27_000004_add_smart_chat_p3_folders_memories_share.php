<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_smart_chat_folders')) {
            Schema::create('moabom_smart_chat_folders', function (Blueprint $table): void {
                $table->id()->comment('폴더 PK');
                $table->foreignId('user_id')->comment('소유자')->constrained('users')->cascadeOnDelete();
                $table->uuid('uuid')->unique()->comment('외부 노출 UUID');
                $table->string('name', 80)->comment('폴더명');
                $table->unsignedInteger('sort_order')->default(0)->comment('정렬');
                $table->timestamps();

                $table->index(['user_id', 'sort_order']);
            });
        }

        if (! Schema::hasTable('moabom_smart_chat_memories')) {
            Schema::create('moabom_smart_chat_memories', function (Blueprint $table): void {
                $table->id()->comment('메모리 PK');
                $table->foreignId('user_id')->comment('소유자')->constrained('users')->cascadeOnDelete();
                $table->uuid('uuid')->unique()->comment('외부 노출 UUID');
                $table->string('content', 500)->comment('기억 문장');
                $table->foreignId('source_conversation_id')->nullable()->comment('출처 대화')
                    ->constrained('moabom_smart_chat_conversations')->nullOnDelete();
                $table->timestamps();

                $table->index(['user_id', 'id']);
            });
        }

        if (Schema::hasTable('moabom_smart_chat_conversations')) {
            Schema::table('moabom_smart_chat_conversations', function (Blueprint $table): void {
                if (! Schema::hasColumn('moabom_smart_chat_conversations', 'folder_id')) {
                    $table->foreignId('folder_id')->nullable()->after('user_id')->comment('폴더 FK')
                        ->constrained('moabom_smart_chat_folders')->nullOnDelete();
                }
                if (! Schema::hasColumn('moabom_smart_chat_conversations', 'share_token')) {
                    $table->uuid('share_token')->nullable()->unique()->after('model_id')
                        ->comment('공개 공유 토큰');
                }
                if (! Schema::hasColumn('moabom_smart_chat_conversations', 'share_enabled_at')) {
                    $table->timestamp('share_enabled_at')->nullable()->after('share_token')
                        ->comment('공유 활성화 시각');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('moabom_smart_chat_conversations')) {
            Schema::table('moabom_smart_chat_conversations', function (Blueprint $table): void {
                if (Schema::hasColumn('moabom_smart_chat_conversations', 'folder_id')) {
                    $table->dropConstrainedForeignId('folder_id');
                }
                if (Schema::hasColumn('moabom_smart_chat_conversations', 'share_enabled_at')) {
                    $table->dropColumn('share_enabled_at');
                }
                if (Schema::hasColumn('moabom_smart_chat_conversations', 'share_token')) {
                    $table->dropColumn('share_token');
                }
            });
        }

        Schema::dropIfExists('moabom_smart_chat_memories');
        Schema::dropIfExists('moabom_smart_chat_folders');
    }
};
