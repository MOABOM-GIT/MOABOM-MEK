<?php

namespace Modules\Moabom\Chat\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Moabom\Chat\Enums\ChatConversationType;

class ChatConversation extends Model
{
    use SoftDeletes;

    protected $table = 'moabom_chat_conversations';

    protected $fillable = [
        'uuid',
        'type',
        'title',
        'direct_key',
        'created_by',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => ChatConversationType::class,
            'last_message_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function members(): HasMany
    {
        return $this->hasMany(ChatConversationMember::class, 'conversation_id');
    }

    public function membersIncludingTrashed(): HasMany
    {
        return $this->hasMany(ChatConversationMember::class, 'conversation_id')->withTrashed();
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(ChatMessage::class, 'conversation_id')->latestOfMany();
    }
}
