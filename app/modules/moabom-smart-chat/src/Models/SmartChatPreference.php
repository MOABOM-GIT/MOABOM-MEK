<?php

namespace Modules\Moabom\Smart\Chat\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmartChatPreference extends Model
{
    protected $table = 'moabom_smart_chat_preferences';

    protected $fillable = [
        'user_id',
        'custom_instructions',
        'enabled_tools',
        'web_search_enabled',
    ];

    protected function casts(): array
    {
        return [
            'enabled_tools' => 'array',
            'web_search_enabled' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
