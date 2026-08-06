<?php

namespace Modules\Moabom\Smart\Chat\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SmartChatConversation extends Model
{
    protected $table = 'moabom_smart_chat_conversations';

    protected $fillable = [
        'user_id',
        'uuid',
        'title',
        'model_id',
        'folder_id',
        'share_token',
        'share_enabled_at',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'share_enabled_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(SmartChatFolder::class, 'folder_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SmartChatMessage::class, 'conversation_id');
    }
}
