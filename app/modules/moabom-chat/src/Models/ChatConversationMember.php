<?php

namespace Modules\Moabom\Chat\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Moabom\Chat\Enums\ChatMemberRole;

class ChatConversationMember extends Model
{
    use SoftDeletes;

    protected $table = 'moabom_chat_conversation_members';

    protected $fillable = [
        'conversation_id',
        'user_id',
        'role',
        'last_read_at',
        'last_read_message_id',
        'muted_until',
    ];

    protected function casts(): array
    {
        return [
            'role' => ChatMemberRole::class,
            'last_read_at' => 'datetime',
            'muted_until' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
