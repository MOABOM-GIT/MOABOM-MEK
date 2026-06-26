<?php

namespace Modules\Moabom\Presence\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformPresenceSession extends Model
{
    protected $connection = 'moabom_platform';

    protected $table = 'moabom_presence_platform_sessions';

    protected $fillable = [
        'session_key',
        'visitor_id',
        'tenant_slug',
        'user_uuid',
        'display_name',
        'is_authenticated',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'is_authenticated' => 'boolean',
            'last_seen_at' => 'datetime',
        ];
    }
}
