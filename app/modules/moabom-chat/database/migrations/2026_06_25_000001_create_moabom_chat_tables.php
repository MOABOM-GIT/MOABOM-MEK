<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_chat_conversations')) {
            Schema::create('moabom_chat_conversations', function (Blueprint $table): void {
                $table->id()->comment('대화방 ID');
                $table->uuid('uuid')->unique('moabom_chat_conversations_uuid_uq')->comment('대화방 UUID');
                $table->string('type', 16)->default('direct')->comment('대화방 유형 (direct: 1:1, group: 그룹)');
                $table->string('title', 120)->nullable()->comment('그룹 대화방 제목');
                $table->string('direct_key', 64)->nullable()->comment('1:1 대화 중복 방지 키');
                $table->foreignId('created_by')->comment('생성자 ID')->constrained('users')->cascadeOnDelete();
                $table->timestamp('last_message_at')->nullable()->comment('마지막 메시지 시각');
                $table->timestamps();
                $table->softDeletes();

                $table->index(['type', 'last_message_at'], 'moabom_chat_conversations_type_last_idx');
                $table->index('created_by', 'moabom_chat_conversations_creator_idx');
                $table->unique('direct_key', 'moabom_chat_conversations_direct_key_uq');
            });
        }

        if (! Schema::hasTable('moabom_chat_conversation_members')) {
            Schema::create('moabom_chat_conversation_members', function (Blueprint $table): void {
                $table->id()->comment('대화방 멤버 ID');
                $table->foreignId('conversation_id')->comment('대화방 ID')->constrained('moabom_chat_conversations')->cascadeOnDelete();
                $table->foreignId('user_id')->comment('사용자 ID')->constrained('users')->cascadeOnDelete();
                $table->string('role', 16)->default('member')->comment('멤버 역할 (owner: 방장, member: 멤버)');
                $table->timestamp('last_read_at')->nullable()->comment('마지막 읽음 시각');
                $table->unsignedBigInteger('last_read_message_id')->nullable()->comment('마지막 읽은 메시지 ID');
                $table->timestamp('muted_until')->nullable()->comment('알림 음소거 종료 시각');
                $table->timestamps();
                $table->softDeletes();

                $table->unique(['conversation_id', 'user_id'], 'moabom_chat_members_conv_user_uq');
                $table->index('user_id', 'moabom_chat_members_user_idx');
                $table->index('last_read_message_id', 'moabom_chat_members_read_msg_idx');
            });
        }

        if (! Schema::hasTable('moabom_chat_messages')) {
            Schema::create('moabom_chat_messages', function (Blueprint $table): void {
                $table->id()->comment('메시지 ID');
                $table->uuid('uuid')->unique('moabom_chat_messages_uuid_uq')->comment('메시지 UUID');
                $table->foreignId('conversation_id')->comment('대화방 ID')->constrained('moabom_chat_conversations')->cascadeOnDelete();
                $table->foreignId('sender_id')->comment('발신자 ID')->constrained('users')->cascadeOnDelete();
                $table->uuid('client_message_id')->nullable()->comment('클라이언트 멱등 메시지 UUID');
                $table->string('type', 16)->default('text')->comment('메시지 유형 (text: 일반 텍스트)');
                $table->text('body')->comment('메시지 내용');
                $table->timestamp('edited_at')->nullable()->comment('수정 시각');
                $table->timestamps();
                $table->softDeletes();

                $table->index(['conversation_id', 'id'], 'moabom_chat_messages_conv_cursor_idx');
                $table->index(['conversation_id', 'created_at'], 'moabom_chat_messages_conv_created_idx');
                $table->unique(['conversation_id', 'sender_id', 'client_message_id'], 'moabom_chat_messages_client_uq');
            });
        }

        if (! Schema::hasTable('moabom_chat_user_blocks')) {
            Schema::create('moabom_chat_user_blocks', function (Blueprint $table): void {
                $table->id()->comment('대화거부 ID');
                $table->foreignId('blocker_id')->comment('대화거부 설정 사용자 ID')->constrained('users')->cascadeOnDelete();
                $table->foreignId('blocked_id')->comment('대화거부 대상 사용자 ID')->constrained('users')->cascadeOnDelete();
                $table->string('reason', 255)->nullable()->comment('대화거부 사유');
                $table->timestamps();

                $table->unique(['blocker_id', 'blocked_id'], 'moabom_chat_blocks_pair_uq');
                $table->index('blocked_id', 'moabom_chat_blocks_blocked_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_chat_user_blocks');
        Schema::dropIfExists('moabom_chat_messages');
        Schema::dropIfExists('moabom_chat_conversation_members');
        Schema::dropIfExists('moabom_chat_conversations');
    }
};
