<?php

namespace Modules\Moabom\Presence\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Moabom\Presence\Enums\FriendshipStatus;

class Friendship extends Model
{
    protected $table = 'moabom_presence_friendships';

    protected $fillable = [
        'requester_id',
        'addressee_id',
        'status',
        'accepted_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => FriendshipStatus::class,
            'accepted_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function addressee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'addressee_id');
    }
}
