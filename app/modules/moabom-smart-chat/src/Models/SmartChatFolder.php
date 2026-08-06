<?php

namespace Modules\Moabom\Smart\Chat\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SmartChatFolder extends Model
{
    protected $table = 'moabom_smart_chat_folders';

    protected $fillable = [
        'user_id',
        'uuid',
        'name',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(SmartChatConversation::class, 'folder_id');
    }
}
