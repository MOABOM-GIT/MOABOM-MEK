<?php

namespace Modules\Moabom\Smart\Chat\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmartChatMemory extends Model
{
    protected $table = 'moabom_smart_chat_memories';

    protected $fillable = [
        'user_id',
        'uuid',
        'content',
        'source_conversation_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sourceConversation(): BelongsTo
    {
        return $this->belongsTo(SmartChatConversation::class, 'source_conversation_id');
    }
}
