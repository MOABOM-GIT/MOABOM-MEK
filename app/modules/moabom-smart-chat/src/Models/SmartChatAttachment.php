<?php

namespace Modules\Moabom\Smart\Chat\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmartChatAttachment extends Model
{
    protected $table = 'moabom_smart_chat_attachments';

    protected $fillable = [
        'user_id',
        'conversation_id',
        'message_id',
        'uuid',
        'original_name',
        'mime',
        'kind',
        'size_bytes',
        'storage_path',
        'extracted_text',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
