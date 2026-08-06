<?php

namespace Modules\Moabom\Smart\Chat\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmartChatMessage extends Model
{
    protected $table = 'moabom_smart_chat_messages';

    protected $fillable = [
        'conversation_id',
        'role',
        'content',
        'parts',
        'status',
        'model_id',
        'prompt_tokens',
        'completion_tokens',
        'parent_id',
    ];

    protected function casts(): array
    {
        return [
            'parts' => 'array',
            'prompt_tokens' => 'integer',
            'completion_tokens' => 'integer',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(SmartChatConversation::class, 'conversation_id');
    }
}
