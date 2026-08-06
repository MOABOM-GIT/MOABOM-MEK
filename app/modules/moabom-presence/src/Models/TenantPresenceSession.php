<?php

namespace Modules\Moabom\Presence\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantPresenceSession extends Model
{
    protected $table = 'moabom_presence_tenant_sessions';

    protected $fillable = [
        'session_key',
        'visitor_id',
        'user_id',
        'display_name',
        'status_text',
        'avatar',
        'is_authenticated',
        'client_form_factor',
        'client_ip_masked',
        'ws_reachable_until',
        'presence_online_until',
        'ws_state',
        'visibility_state',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'is_authenticated' => 'boolean',
            'ws_reachable_until' => 'datetime',
            'presence_online_until' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
