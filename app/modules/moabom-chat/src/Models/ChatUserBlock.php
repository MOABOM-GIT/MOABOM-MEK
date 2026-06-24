<?php

namespace Modules\Moabom\Chat\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatUserBlock extends Model
{
    protected $table = 'moabom_chat_user_blocks';

    protected $fillable = [
        'blocker_id',
        'blocked_id',
        'reason',
    ];

    public function blocker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocker_id');
    }

    public function blocked(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_id');
    }
}
