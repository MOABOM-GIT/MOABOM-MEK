<?php

namespace Modules\Moabom\Presence\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Moabom\Presence\Enums\PresenceAvailability;
use Modules\Moabom\Presence\Enums\PresenceSubtitleMode;

class PresenceUserPreference extends Model
{
    protected $table = 'moabom_presence_user_preferences';

    protected $fillable = [
        'user_id',
        'availability',
        'subtitle_mode',
        'activity_message',
    ];

    protected function casts(): array
    {
        return [
            'availability' => PresenceAvailability::class,
            'subtitle_mode' => PresenceSubtitleMode::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
